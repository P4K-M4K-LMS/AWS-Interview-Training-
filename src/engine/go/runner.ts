import type { PyRunRequest, PyRunResult } from "../python/execute";
import type { RunnerStatus } from "../python/runner";

/**
 * Main-thread client for the Go Web Worker (Yaegi interpreter in
 * WebAssembly). Same contract as the Python runner: real results only, and
 * a wall-clock timeout enforced by terminating and recreating the worker.
 */
export class GoRunner {
  private worker: Worker | null = null;
  private ready: Promise<string> | null = null;
  private pending = new Map<string, { resolve: (r: PyRunResult) => void; timer: ReturnType<typeof setTimeout> }>();
  status: RunnerStatus = "idle";
  version = "";
  private listeners = new Set<(s: RunnerStatus, detail?: string) => void>();
  readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
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

  static indexURL(): string {
    const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + "/";
    return new URL(base + "go/", window.location.origin).toString();
  }

  /** Checks whether the runtime artifact was built and deployed. */
  static async available(): Promise<boolean> {
    try {
      const res = await fetch(GoRunner.indexURL() + "wasm_exec.js", { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  warmup(): Promise<string> {
    if (this.ready) return this.ready;
    this.setStatus("loading");
    this.ready = new Promise<string>((resolve, reject) => {
      const w = new Worker(new URL("../../workers/go.worker.ts", import.meta.url));
      this.worker = w;
      w.onmessage = (ev: MessageEvent) => {
        const m = ev.data;
        if (m.type === "ready") {
          this.version = m.version;
          this.setStatus("ready");
          resolve(m.version);
        } else if (m.type === "init-error") {
          this.setStatus("error", m.message);
          reject(new Error(m.message));
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
      w.postMessage({ type: "init", indexURL: GoRunner.indexURL() });
    });
    return this.ready;
  }

  async run(req: Omit<PyRunRequest, "id"> & { id?: string }): Promise<PyRunResult> {
    await this.warmup();
    const id = req.id ?? `go_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.setStatus("running");
    return new Promise<PyRunResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.terminate();
        resolve({
          id,
          stdout: "",
          stderr: "",
          error: `Execution stopped after ${this.timeoutMs / 1000}s. Your program may contain an infinite loop, a deadlock, or far too much work. The Go runtime was restarted.`,
          errorType: "TimeoutError",
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

let shared: GoRunner | null = null;
export function getGoRunner(): GoRunner {
  if (!shared) shared = new GoRunner();
  return shared;
}
