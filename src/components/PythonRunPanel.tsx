import { useEffect, useState } from "react";
import { getPythonRunner, type RunnerStatus } from "../engine/python/runner";
import { getGoRunner } from "../engine/go/runner";
import type { PyRunResult } from "../engine/python/execute";
import type { CodeLanguage, CodeMission } from "../domain/types";
import { Callout } from "./ui";

/** Picks the in-browser runtime for a language; both share the same contract. */
export function useCodeRunner(language: CodeLanguage) {
  const runner = language === "go" ? getGoRunner() : getPythonRunner();
  const [status, setStatus] = useState<RunnerStatus>(runner.status);
  const [detail, setDetail] = useState<string | undefined>();
  useEffect(() => {
    const off = runner.onStatus((s, d) => {
      setStatus(s);
      setDetail(d);
    });
    void runner.warmup().catch(() => undefined);
    return () => {
      off();
    };
  }, [runner]);
  return { runner, status, detail };
}

export function usePythonRunner() {
  return useCodeRunner("python");
}

export function RunnerStatusLine({ status, detail, version, language = "python" }: { status: RunnerStatus; detail?: string; version?: string; language?: CodeLanguage }) {
  const name = language === "go" ? "Go" : "Python";
  const loading = language === "go" ? "Loading the Go runtime (Yaegi in WebAssembly, ~8 MB compressed, cached after the first load)..." : "Loading the Python interpreter (Pyodide, ~14 MB, cached after the first load)...";
  const text =
    status === "loading"
      ? loading
      : status === "ready"
        ? `${name} ${version || ""} ready. Code runs in an isolated Web Worker in your browser.`
        : status === "running"
          ? "Running..."
          : status === "error"
            ? `Interpreter failed to load: ${detail ?? "unknown error"}. Check your connection and reload.`
            : "Interpreter idle.";
  return (
    <div className="text-xs muted flex items-center gap-2" aria-live="polite">
      <span className={`inline-block w-2 h-2 rounded-full ${status === "ready" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
      {text}
    </div>
  );
}

export function RunOutput({ result, errorHelp }: { result: PyRunResult | null; errorHelp?: CodeMission["errorHelp"] }) {
  if (!result) return <div className="text-sm muted">Run your code to see real output here.</div>;
  const help = result.error && errorHelp ? errorHelp.find((h) => h.match.test(result.error!)) : undefined;
  return (
    <div className="space-y-2">
      <div className="text-xs muted">
        Finished in {result.durationMs} ms{result.timedOut ? " (timed out)" : ""}
      </div>
      {result.stdout ? <pre className="terminal rounded p-2 text-xs whitespace-pre-wrap" data-testid="python-stdout">{result.stdout}</pre> : <div className="text-xs muted">(no standard output)</div>}
      {result.stderr && <pre className="rounded p-2 text-xs whitespace-pre-wrap bg-amber-950/40 text-amber-200">{result.stderr}</pre>}
      {result.error && (
        <div className="space-y-1">
          <pre className="rounded p-2 text-xs whitespace-pre-wrap bg-red-950/50 text-red-200" data-testid="python-error">{result.error}</pre>
          {help && (
            <Callout kind="warn" title={`About this ${result.errorType ?? "error"}`}>
              {help.explanation}
            </Callout>
          )}
        </div>
      )}
      {result.tests.length > 0 && (
        <ul className="text-sm space-y-1" data-testid="python-tests">
          {result.tests.map((t) => (
            <li key={t.id} className={t.passed ? "text-emerald-400" : "text-red-400"}>
              {t.passed ? "✓" : "✗"} {t.id}
              {!t.passed && t.error && <pre className="text-xs whitespace-pre-wrap muted ml-4">{t.error.split("\n").slice(-3).join("\n")}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
