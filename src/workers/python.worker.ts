/// <reference lib="webworker" />
/**
 * Web Worker that owns a Pyodide interpreter. Learner code never runs on the
 * main thread, and the main thread can terminate this worker on timeout.
 */
import { loadPyodide } from "pyodide";
import { executeInPyodide, type PyodideLike, type PyRunRequest } from "../engine/python/execute";

type InMsg = { type: "init"; indexURL: string } | ({ type: "run" } & PyRunRequest);
type OutMsg =
  | { type: "ready"; version: string }
  | { type: "init-error"; message: string }
  | { type: "result"; result: ReturnType<typeof executeInPyodide> };

let pyodide: PyodideLike | null = null;
const queue: PyRunRequest[] = [];

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "init") {
    try {
      const py = await loadPyodide({ indexURL: msg.indexURL });
      pyodide = py as unknown as PyodideLike;
      const version = String(py.runPython("import sys; f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}'"));
      post({ type: "ready", version });
      while (queue.length) run(queue.shift()!);
    } catch (e) {
      post({ type: "init-error", message: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  if (msg.type === "run") {
    const { type: _t, ...req } = msg;
    void _t;
    if (!pyodide) queue.push(req);
    else run(req);
  }
};

function run(req: PyRunRequest) {
  const result = executeInPyodide(pyodide!, req);
  post({ type: "result", result });
}

function post(m: OutMsg) {
  (self as unknown as Worker).postMessage(m);
}
