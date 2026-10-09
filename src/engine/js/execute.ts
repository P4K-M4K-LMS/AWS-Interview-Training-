import { deepEqual, inspect } from "./inspect";
import { createSimFetch, type FetchLogEntry } from "./simApi";

/**
 * Runs learner JavaScript and reports only what really happened. Shared by
 * the browser Web Worker and the Node test suite.
 *
 * Script mode: the program is the body of an async function in strict mode
 * (so top-level await works and an unbound `this` is undefined, as in a
 * module). The tests are compiled into the same body as closures, so they
 * see the program's top-level bindings. Console, timers and fetch are
 * passed in as parameters that shadow the globals: output is captured,
 * timers are tracked so the run waits for them, and fetch reaches only the
 * simulated API.
 *
 * Module mode: each file is a real ES module loaded from a data: URL, with
 * "./name.js" imports rewritten to the other files' URLs, so import and
 * export behave exactly as the language says. Globals are swapped for the
 * capturing versions during the run and restored afterwards; tests receive
 * every module's namespace.
 */
export interface JsTest {
  id: string;
  code: string;
}

export interface JsRunRequest {
  id: string;
  code?: string;
  files?: Record<string, string>;
  entry?: string;
  tests?: JsTest[];
}

export interface JsLog {
  level: "log" | "info" | "warn" | "error";
  text: string;
}

export interface JsTestResult {
  id: string;
  passed: boolean;
  error?: string;
  logs?: JsLog[];
}

export interface JsRunResult {
  id: string;
  logs: JsLog[];
  error: string | null;
  errorType: string | null;
  /** Line in the learner's code (script mode) or "file:line" (module mode), when the engine reports one. */
  errorAt: string | null;
  durationMs: number;
  tests: JsTestResult[];
  timedOut?: boolean;
}

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

/** Lines the async function wrapper adds before the learner's first line. */
const SCRIPT_LINE_OFFSET = 3;
const PROGRAM_DEADLINE_MS = 4000;
const TEST_DEADLINE_MS = 3000;
const SETTLE_MS = 2000;

type Timer = ReturnType<typeof setTimeout>;

let activeReporter: ((e: unknown) => void) | null = null;

/** The worker forwards unhandled promise rejections here, attributed to the run in progress. */
export function reportAsyncError(e: unknown): void {
  activeReporter?.(e);
}

function describeError(e: unknown): { text: string; type: string } {
  if (e instanceof Error) return { text: `${e.name}: ${e.message}`, type: e.name };
  return { text: `Uncaught ${inspect(e, 1)}`, type: "Thrown value" };
}

function locate(e: unknown, fileUrls: Record<string, string>): string | null {
  if (!(e instanceof Error) || !e.stack) return null;
  for (const line of e.stack.split("\n")) {
    const anon = /<anonymous>:(\d+):(\d+)/.exec(line);
    if (anon) {
      const n = Number(anon[1]) - SCRIPT_LINE_OFFSET;
      if (n >= 1) return `line ${n}`;
    }
    for (const [file, url] of Object.entries(fileUrls)) {
      const i = line.indexOf(url);
      if (i >= 0) {
        const m = /:(\d+):(\d+)\)?\s*$/.exec(line.slice(i + url.length));
        if (m) return `${file} line ${m[1]}`;
      }
    }
  }
  return null;
}

function withDeadline<T>(p: Promise<T>, ms: number, what: string, realSetTimeout: typeof setTimeout, realClearTimeout: typeof clearTimeout): Promise<T> {
  let h: Timer | undefined;
  const timeout = new Promise<never>((_, reject) => {
    h = realSetTimeout(() => reject(new Error(`${what} did not finish within ${ms / 1000} s (a promise that never settles?)`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => realClearTimeout(h));
}

/** Imports between the exercise's files: "./name.js" only. */
function importsOf(src: string): string[] {
  const out = new Set<string>();
  const re = /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1] ?? m[2] ?? m[3]);
  return [...out];
}

function moduleOrder(files: Record<string, string>): string[] {
  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string, from: string | null) => {
    if (!(name in files)) throw new Error(`${from ?? "the exercise"} imports "./${name}", but there is no file named ${name}`);
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") throw new Error(`circular imports involving ${name} are not supported in this lab`);
    state.set(name, "visiting");
    for (const spec of importsOf(files[name])) {
      if (!spec.startsWith("./")) throw new Error(`${name} imports "${spec}": only "./file.js" imports between this exercise's files are available`);
      visit(spec.slice(2), name);
    }
    state.set(name, "done");
    order.push(name);
  };
  for (const name of Object.keys(files)) visit(name, null);
  return order;
}

export async function executeJs(req: JsRunRequest): Promise<JsRunResult> {
  const perf = typeof performance !== "undefined" ? performance : { now: () => Date.now() };
  const t0 = perf.now();
  const now = () => perf.now() - t0;
  const realSetTimeout = globalThis.setTimeout.bind(globalThis);
  const realClearTimeout = globalThis.clearTimeout.bind(globalThis);
  const realSetInterval = globalThis.setInterval.bind(globalThis);
  const realClearInterval = globalThis.clearInterval.bind(globalThis);

  const logs: JsLog[] = [];
  const write = (level: JsLog["level"]) => (...args: unknown[]) => {
    logs.push({ level, text: args.map((a) => inspect(a)).join(" ") });
  };
  const capturedConsole = { log: write("log"), info: write("info"), debug: write("log"), warn: write("warn"), error: write("error"), table: write("log"), dir: write("log") };
  const asyncError = (e: unknown) => {
    const d = describeError(e);
    logs.push({ level: "error", text: `Uncaught ${d.text}` });
  };
  activeReporter = asyncError;

  // Timers the run waits for; callbacks that throw are reported like the browser does.
  const pendingTimeouts = new Set<Timer>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const trackedSetTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const h: Timer = realSetTimeout(() => {
      pendingTimeouts.delete(h);
      try {
        fn(...args);
      } catch (e) {
        asyncError(e);
      }
    }, ms);
    pendingTimeouts.add(h);
    return h;
  };
  const trackedClearTimeout = (h: Timer) => {
    pendingTimeouts.delete(h);
    realClearTimeout(h);
  };
  const trackedSetInterval = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const h = realSetInterval(() => {
      try {
        fn(...args);
      } catch (e) {
        asyncError(e);
      }
    }, ms);
    intervals.add(h);
    return h;
  };
  const trackedClearInterval = (h: ReturnType<typeof setInterval>) => {
    intervals.delete(h);
    realClearInterval(h);
  };
  const sleep = (ms: number) => new Promise<void>((resolve) => realSetTimeout(resolve, ms));
  const settle = async (limitMs: number) => {
    const end = now() + limitMs;
    // Let queued microtasks run, then wait for pending timeouts (intervals never finish on their own).
    await sleep(0);
    while (pendingTimeouts.size > 0 && now() < end) await sleep(5);
  };

  const api = createSimFetch(trackedSetTimeout, now);
  let programLogs: string[] = [];

  // Assertion helpers available to tests.
  const assert = (cond: unknown, message?: string) => {
    if (!cond) throw new AssertionError(message ?? "assertion failed");
  };
  const assertEqual = (actual: unknown, expected: unknown, message?: string) => {
    if (!deepEqual(actual, expected)) throw new AssertionError(`${message ? `${message}: ` : ""}got ${inspect(actual, 1)}, expected ${inspect(expected, 1)}`);
  };
  const assertThrows = (fn: () => unknown, ErrorType?: new (...a: never[]) => Error, message?: string) => {
    try {
      fn();
    } catch (e) {
      if (ErrorType && !(e instanceof ErrorType)) throw new AssertionError(`${message ? `${message}: ` : ""}expected a ${ErrorType.name}, got ${describeError(e).text}`);
      return e;
    }
    throw new AssertionError(message ?? `expected an error${ErrorType ? ` (${ErrorType.name})` : ""}, but nothing was thrown`);
  };
  const assertRejects = async (p: Promise<unknown> | (() => Promise<unknown>), ErrorType?: new (...a: never[]) => Error, message?: string) => {
    try {
      await (typeof p === "function" ? p() : p);
    } catch (e) {
      if (ErrorType && !(e instanceof ErrorType)) throw new AssertionError(`${message ? `${message}: ` : ""}expected a ${ErrorType.name}, got ${describeError(e).text}`);
      return e;
    }
    throw new AssertionError(message ?? "expected the promise to reject, but it resolved");
  };
  const helpers: Record<string, unknown> = {
    assert,
    assertEqual,
    assertThrows,
    assertRejects,
    logs: () => [...programLogs],
    fetchLog: () => api.log.map((e: FetchLogEntry) => ({ ...e })),
    sleep,
  };

  let error: string | null = null;
  let errorType: string | null = null;
  let errorAt: string | null = null;
  let thunks: Array<() => Promise<unknown>> = [];
  const fileUrls: Record<string, string> = {};
  const restore: Array<() => void> = [];

  try {
    if (req.files) {
      const g = globalThis as unknown as Record<string, unknown>;
      const swap = (name: string, value: unknown) => {
        const had = Object.hasOwn(g, name);
        const prev = g[name];
        g[name] = value;
        restore.push(() => {
          if (had) g[name] = prev;
          else delete g[name];
        });
      };
      swap("console", capturedConsole);
      swap("fetch", api.fetch);
      swap("setTimeout", trackedSetTimeout);
      swap("clearTimeout", trackedClearTimeout);
      swap("setInterval", trackedSetInterval);
      swap("clearInterval", trackedClearInterval);
      const nonce = Math.random().toString(36).slice(2);
      const order = moduleOrder(req.files);
      for (const name of order) {
        const src = req.files[name].replace(/(from\s*|import\s*\(?\s*)(["'])\.\/([^"']+)\2/g, (_all, lead: string, q: string, file: string) => `${lead}${q}${fileUrls[file]}${q}`);
        fileUrls[name] = `data:text/javascript;charset=utf-8,${encodeURIComponent(`${src}\n//# opsforge run ${nonce} ${name}`)}`;
      }
      const modules: Record<string, unknown> = {};
      const entry = req.entry ?? order[order.length - 1];
      modules[entry] = await withDeadline(import(/* @vite-ignore */ fileUrls[entry]), PROGRAM_DEADLINE_MS, "The program", realSetTimeout, realClearTimeout);
      for (const name of order) if (!(name in modules)) modules[name] = await import(/* @vite-ignore */ fileUrls[name]);
      const names = [...Object.keys(helpers), "modules", "$source"];
      thunks = (req.tests ?? []).map((t) => {
        const fn = new AsyncFunction(...names, `"use strict";\n${t.code}`);
        return () => fn(...Object.values(helpers), modules, { ...req.files });
      });
    } else {
      const shadows: Record<string, unknown> = {
        console: capturedConsole,
        fetch: api.fetch,
        setTimeout: trackedSetTimeout,
        clearTimeout: trackedClearTimeout,
        setInterval: trackedSetInterval,
        clearInterval: trackedClearInterval,
        ...helpers,
        $source: req.code ?? "",
      };
      const body = `"use strict";\n${req.code ?? ""}\n;return [${(req.tests ?? []).map((t) => `async () => {\n${t.code}\n}`).join(",\n")}];`;
      const fn = new AsyncFunction(...Object.keys(shadows), body);
      thunks = (await withDeadline(fn(...Object.values(shadows)), PROGRAM_DEADLINE_MS, "The program", realSetTimeout, realClearTimeout)) as Array<() => Promise<unknown>>;
    }
  } catch (e) {
    const d = describeError(e);
    error = e instanceof SyntaxError ? `${d.text} (the program could not be parsed, so nothing ran)` : d.text;
    errorType = d.type;
    errorAt = e instanceof SyntaxError ? null : locate(e, fileUrls);
    thunks = [];
  }

  await settle(SETTLE_MS);
  programLogs = logs.filter((l) => l.level === "log" || l.level === "info").map((l) => l.text);

  const tests: JsTestResult[] = [];
  if (error && req.tests?.length) {
    for (const t of req.tests) tests.push({ id: t.id, passed: false, error: "Not run: the program raised an error before the tests could start." });
  } else {
    for (let i = 0; i < (req.tests ?? []).length; i++) {
      const t = req.tests![i];
      const before = logs.length;
      try {
        await withDeadline(thunks[i](), TEST_DEADLINE_MS, "The test", realSetTimeout, realClearTimeout);
        await settle(1000);
        tests.push({ id: t.id, passed: true, logs: logs.slice(before) });
      } catch (e) {
        await settle(200);
        tests.push({ id: t.id, passed: false, error: describeError(e).text, logs: logs.slice(before) });
      }
    }
  }

  const leftOver = pendingTimeouts.size + intervals.size;
  for (const h of pendingTimeouts) realClearTimeout(h);
  for (const h of intervals) realClearInterval(h);
  if (leftOver) logs.push({ level: "warn", text: `${leftOver} timer${leftOver === 1 ? "" : "s"} still pending at the end of the run ${leftOver === 1 ? "was" : "were"} cancelled.` });
  for (const r of restore.reverse()) r();
  if (activeReporter === asyncError) activeReporter = null;

  return { id: req.id, logs, error, errorType, errorAt, durationMs: Math.round(now()), tests };
}
