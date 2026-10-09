import { deepEqual, inspect } from "./inspect";

/**
 * A small Jest-style test API for the lab's testing drill: test(name, fn),
 * expect(value) with the common matchers (and .not, .resolves, .rejects),
 * and mock(impl) for recording calls. It is not Jest: it covers the shape
 * learners meet in real projects, with plain messages, and nothing else.
 */
export interface SuiteResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface MockFn {
  (...args: unknown[]): unknown;
  calls: unknown[][];
}

export class ExpectationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectationError";
  }
}

type Matcher = (actual: unknown, ...args: unknown[]) => { pass: boolean; message: string };

const show = (v: unknown) => inspect(v, 1);

const MATCHERS: Record<string, Matcher> = {
  toBe: (a, e) => ({ pass: Object.is(a, e), message: `expected ${show(a)} to be ${show(e)}` }),
  toEqual: (a, e) => ({ pass: deepEqual(a, e), message: `expected ${show(a)} to equal ${show(e)}` }),
  toBeTruthy: (a) => ({ pass: Boolean(a), message: `expected ${show(a)} to be truthy` }),
  toBeFalsy: (a) => ({ pass: !a, message: `expected ${show(a)} to be falsy` }),
  toBeNull: (a) => ({ pass: a === null, message: `expected ${show(a)} to be null` }),
  toBeUndefined: (a) => ({ pass: a === undefined, message: `expected ${show(a)} to be undefined` }),
  toBeGreaterThan: (a, e) => ({ pass: (a as number) > (e as number), message: `expected ${show(a)} to be greater than ${show(e)}` }),
  toBeLessThan: (a, e) => ({ pass: (a as number) < (e as number), message: `expected ${show(a)} to be less than ${show(e)}` }),
  toBeCloseTo: (a, e, digits = 2) => ({ pass: Math.abs((a as number) - (e as number)) < 10 ** -(digits as number) / 2, message: `expected ${show(a)} to be close to ${show(e)}` }),
  toContain: (a, e) => ({ pass: typeof a === "string" ? a.includes(String(e)) : Array.isArray(a) && a.some((x) => deepEqual(x, e)), message: `expected ${show(a)} to contain ${show(e)}` }),
  toHaveLength: (a, n) => ({ pass: (a as { length?: number })?.length === n, message: `expected length ${show((a as { length?: number })?.length)} to be ${show(n)}` }),
  toHaveBeenCalled: (a) => ({ pass: ((a as MockFn).calls?.length ?? 0) > 0, message: "expected the mock to have been called" }),
  toHaveBeenCalledTimes: (a, n) => ({ pass: (a as MockFn).calls?.length === n, message: `expected the mock to have been called ${n} times, it was called ${(a as MockFn).calls?.length ?? 0}` }),
  toHaveBeenCalledWith: (a, ...args) => ({ pass: ((a as MockFn).calls ?? []).some((c) => deepEqual(c, args)), message: `expected the mock to have been called with ${show(args)}; calls: ${show((a as MockFn).calls)}` }),
  toThrow: (a, e) => {
    if (typeof a !== "function") return { pass: false, message: "toThrow needs a function: expect(() => ...).toThrow()" };
    try {
      (a as () => unknown)();
    } catch (err) {
      const ok = e === undefined || (typeof e === "function" ? err instanceof (e as new () => Error) : typeof e === "string" ? String((err as Error)?.message).includes(e) : e instanceof RegExp ? e.test(String((err as Error)?.message)) : false);
      return { pass: ok, message: `expected the function to throw ${e === undefined ? "" : show(e)}, it threw ${show(err)}` };
    }
    return { pass: false, message: "expected the function to throw, it did not" };
  },
};

export function createSuite() {
  const registered: Array<{ name: string; fn: () => unknown }> = [];

  const build = (actual: unknown, negate: boolean, wrap: (run: () => void) => unknown) => {
    const api: Record<string, unknown> = {};
    for (const [name, matcher] of Object.entries(MATCHERS)) {
      api[name] = (...args: unknown[]) =>
        wrap(() => {
          const r = matcher(actual, ...args);
          if (r.pass === negate) throw new ExpectationError(negate ? r.message.replace("expected", "expected not") : r.message);
        });
    }
    return api;
  };

  function expect(actual: unknown) {
    const sync = (run: () => void) => run();
    const api = build(actual, false, sync) as Record<string, unknown>;
    api.not = build(actual, true, sync);
    // .resolves / .rejects: await the promise, then apply the matcher to its value or error.
    const asyncApi = (want: "resolves" | "rejects") => {
      const out: Record<string, unknown> = {};
      for (const name of Object.keys(MATCHERS)) {
        out[name] = async (...args: unknown[]) => {
          let value: unknown;
          try {
            value = await actual;
            if (want === "rejects") throw new ExpectationError(`expected the promise to reject, it resolved with ${show(value)}`);
          } catch (err) {
            if (err instanceof ExpectationError) throw err;
            if (want === "resolves") throw new ExpectationError(`expected the promise to resolve, it rejected with ${show(err)}`);
            value = err;
          }
          (expect(want === "rejects" && name === "toThrow" ? () => { throw value; } : value) as Record<string, (...a: unknown[]) => unknown>)[name](...args);
        };
      }
      return out;
    };
    api.resolves = asyncApi("resolves");
    api.rejects = asyncApi("rejects");
    return api;
  }

  function test(name: string, fn: () => unknown) {
    registered.push({ name: String(name), fn });
  }

  function mock(impl?: (...args: unknown[]) => unknown): MockFn {
    const f = ((...args: unknown[]) => {
      f.calls.push(args);
      return impl ? impl(...args) : undefined;
    }) as MockFn;
    f.calls = [];
    return f;
  }

  async function run(deadline: <T>(p: Promise<T>) => Promise<T>): Promise<SuiteResult[]> {
    const results: SuiteResult[] = [];
    for (const t of registered) {
      try {
        await deadline(Promise.resolve().then(() => t.fn()));
        results.push({ name: t.name, passed: true });
      } catch (e) {
        results.push({ name: t.name, passed: false, error: e instanceof Error ? `${e.name}: ${e.message}` : show(e) });
      }
    }
    return results;
  }

  return { test, expect, mock, run, count: () => registered.length };
}
