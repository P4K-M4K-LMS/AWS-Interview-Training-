import type { JsRunRequest, JsRunResult } from "./execute";
import type { RunnerStatus } from "../python/runner";

/**
 * Main-thread client for the JavaScript Web Worker. A run that exceeds the
 * time limit terminates the worker (the only way to stop an infinite loop)
 * and a fresh one starts for the next run.
 */
export class JsRunner {
  private worker: Worker | null = null;
  private ready: Promise<string> | null = null;
  private pending = new Map<string, { resolve: (r: JsRunResult) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<(s: RunnerStatus, detail?: string) => void>();
  status: RunnerStatus = "idle";
  readonly version = "browser JavaScript";
  readonly timeoutMs: number;

  constructor(timeoutMs = 6000) {
    this.timeoutMs = timeoutMs;
  }

  onStatus(fn: (s: RunnerStatus, detail?: string) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: RunnerStatus, detail?: string) {
    this.status = s;
    for (const l of this.listeners) l(s, detail);
  }

  warmup(): Promise<string> {
    if (this.ready) return this.ready;
    this.setStatus("loading");
    this.ready = new Promise<string>((resolve, reject) => {
      const w = new Worker(new URL("../../workers/js.worker.ts", import.meta.url), { type: "module" });
      this.worker = w;
      w.onmessage = (ev: MessageEvent) => {
        const m = ev.data;
        if (m.type === "ready") {
          this.setStatus("ready");
          resolve(this.version);
        } else if (m.type === "result") {
          const p = this.pending.get(m.result.id);
          if (p) {
            clearTimeout(p.timer);
            this.pending.delete(m.result.id);
            p.resolve(m.result);
          }
          if (this.pending.size === 0) this.setStatus("ready");
        }
      };
      w.onerror = (e) => {
        this.setStatus("error", e.message);
        reject(new Error(e.message));
      };
    });
    return this.ready;
  }

  async run(req: Omit<JsRunRequest, "id"> & { id?: string }): Promise<JsRunResult> {
    await this.warmup();
    const id = req.id ?? `js_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.setStatus("running");
    return new Promise<JsRunResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.terminate();
        resolve({
          id,
          logs: [],
          error: `Execution stopped after ${this.timeoutMs / 1000} s. The program may contain an infinite loop. The worker was restarted.`,
          errorType: "TimeoutError",
          errorAt: null,
          durationMs: this.timeoutMs,
          tests: (req.tests ?? []).map((t) => ({ id: t.id, passed: false, error: "Not run: execution timed out." })),
          timedOut: true,
        });
        void this.warmup();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.worker!.postMessage({ type: "run", ...req, id });
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    this.setStatus("idle");
  }
}

let shared: JsRunner | null = null;
export function getJsRunner(): JsRunner {
  if (!shared) shared = new JsRunner();
  return shared;
}
