/* eslint-disable */
/**
 * Classic Web Worker that hosts the Go runner (Yaegi interpreter compiled to
 * WebAssembly). It loads Go's wasm_exec.js shim with importScripts, which
 * requires a classic (non-module) worker, then exposes a message protocol
 * identical to the Python worker's.
 */
import type { PyRunRequest, PyRunResult } from "../engine/python/execute";

declare const importScripts: (...urls: string[]) => void;
declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}
declare function goRun(code: string, testsJson: string): string;

type InMsg = { type: "init"; indexURL: string } | ({ type: "run" } & PyRunRequest);

let ready = false;
const queue: PyRunRequest[] = [];
const ctx = self as unknown as Worker & { goRunnerReady?: boolean };

ctx.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "init") {
    try {
      importScripts(msg.indexURL + "wasm_exec.js");
      const go = new Go();
      const url = msg.indexURL + "gorunner.wasm";
      let instance: WebAssembly.Instance;
      try {
        ({ instance } = await WebAssembly.instantiateStreaming(fetch(url), go.importObject));
      } catch {
        const bytes = await (await fetch(url)).arrayBuffer();
        ({ instance } = await WebAssembly.instantiate(bytes, go.importObject));
      }
      void go.run(instance); // blocks on select{} inside Go; never resolves
      const t0 = Date.now();
      while (!ctx.goRunnerReady) {
        if (Date.now() - t0 > 30_000) throw new Error("Go runtime did not become ready");
        await new Promise((r) => setTimeout(r, 10));
      }
      ready = true;
      ctx.postMessage({ type: "ready", version: "Yaegi (Go 1.24 toolchain)" });
      while (queue.length) run(queue.shift()!);
    } catch (e) {
      ctx.postMessage({ type: "init-error", message: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  if (msg.type === "run") {
    const { type: _t, ...req } = msg;
    void _t;
    if (!ready) queue.push(req);
    else run(req);
  }
};

function run(req: PyRunRequest) {
  const t0 = performance.now();
  const raw = goRun(req.code, JSON.stringify((req.tests ?? []).map((t) => ({ id: t.id, code: t.code }))));
  const r = JSON.parse(raw) as { stdout: string; stderr: string; error: string; millis: number; tests: Array<{ id: string; passed: boolean; error?: string; stdout?: string }> };
  const result: PyRunResult = {
    id: req.id,
    stdout: r.stdout,
    stderr: r.stderr,
    error: r.error || null,
    errorType: r.error ? classify(r.error) : null,
    durationMs: Math.round(performance.now() - t0),
    tests: r.tests.map((t) => ({ id: t.id, passed: t.passed, error: t.error, stdout: t.stdout })),
  };
  ctx.postMessage({ type: "result", result });
}

function classify(err: string): string {
  if (/undefined:/.test(err)) return "undefined identifier";
  if (/cannot use|mismatched types|invalid operation/.test(err)) return "type error";
  if (/expected|unexpected|syntax/.test(err)) return "syntax error";
  if (/index out of range/.test(err)) return "index out of range";
  if (/nil pointer|nil map/.test(err)) return "nil dereference";
  if (/deadlock/.test(err)) return "deadlock";
  if (/panic/.test(err)) return "panic";
  return "error";
}
