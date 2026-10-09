/// <reference lib="webworker" />
/**
 * Web Worker that runs learner JavaScript. Nothing here touches the page:
 * a worker has no document, and the main thread terminates it when a run
 * exceeds its time limit (an infinite loop cannot be interrupted any other
 * way). Network access is limited to the lab's simulated API: the worker's
 * own fetch and the other ways out are replaced before any learner code runs.
 */
import { executeJs, reportAsyncError, type JsRunRequest } from "../engine/js/execute";

type InMsg = { type: "run" } & JsRunRequest;

const scope = self as unknown as Record<string, unknown>;
const refuse = () => {
  throw new TypeError("Network access is not available in this lab; fetch reaches only the simulated API at https://api.fleet.example.");
};
scope.fetch = async () => refuse();
for (const name of ["XMLHttpRequest", "WebSocket", "EventSource", "importScripts"]) scope[name] = undefined;

self.addEventListener("unhandledrejection", (ev) => {
  ev.preventDefault();
  reportAsyncError(ev.reason);
});
self.addEventListener("error", (ev) => {
  ev.preventDefault();
  reportAsyncError(ev.error ?? ev.message);
});

let chain: Promise<void> = Promise.resolve();
self.onmessage = (ev: MessageEvent<InMsg>) => {
  const { type: _t, ...req } = ev.data;
  void _t;
  // One run at a time: module mode swaps globals for the duration of a run.
  chain = chain.then(async () => {
    const result = await executeJs(req);
    (self as unknown as Worker).postMessage({ type: "result", result });
  });
};
(self as unknown as Worker).postMessage({ type: "ready" });
