import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PythonEditor } from "../components/PythonEditor";
import { Callout, PageHeader, Panel } from "../components/ui";
import { JS_DRILLS, JS_DRILL_BY_ID, type JsDrill } from "../content/study/jsDrills";
import { nowIso } from "../data/db";
import type { JsRunResult } from "../engine/js/execute";
import { getJsRunner } from "../engine/js/runner";
import type { RunnerStatus } from "../engine/python/runner";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * JavaScript lab: one idea per drill on the browser's own JavaScript engine,
 * in a Web Worker with a time limit. Script drills are one program; module
 * drills are real ES modules over several files. fetch reaches only the
 * simulated API. Passing every test credits the Study objectives curated
 * for the drill (Guided at most).
 */
export function JsLabPage() {
  const [params, setParams] = useSearchParams();
  const drill = JS_DRILL_BY_ID.get(params.get("exercise") ?? "") ?? JS_DRILLS[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <DrillView key={drill.id} drill={drill} fromPath={fromPath} pick={pick} />;
}

function useJsRunner() {
  const runner = getJsRunner();
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

function DrillView({ drill, fromPath, pick }: { drill: JsDrill; fromPath: string | null; pick: (id: string) => void }) {
  const isModules = Boolean(drill.starterFiles);
  const [code, setCode] = useState(drill.starter ?? "");
  const [files, setFiles] = useState<Record<string, string>>(drill.starterFiles ?? {});
  const fileNames = Object.keys(drill.starterFiles ?? {});
  const [file, setFile] = useState(drill.entry ?? fileNames[0] ?? "");
  const [result, setResult] = useState<JsRunResult | null>(null);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { runner, status, detail } = useJsRunner();
  const allRight = result !== null && result.error === null && result.tests.length === drill.tests.length && result.tests.every((t) => t.passed);
  const credited = objectivesCreditedByExercise(drill.id);
  const index = JS_DRILLS.findIndex((d) => d.id === drill.id);
  const next = JS_DRILLS[index + 1];

  async function run() {
    const tests = drill.tests.map((t) => ({ id: t.id, code: t.code }));
    setResult(await runner.run(isModules ? { files, entry: drill.entry, tests } : { code, tests }));
  }

  async function check() {
    if (!allRight) return;
    await creditLabExercise(drill.id, nowIso());
    setPassed(true);
  }

  const reset = () => {
    setCode(drill.starter ?? "");
    setFiles(drill.starterFiles ?? {});
  };

  return (
    <div className="space-y-4">
      <PageHeader title="JavaScript" subtitle="One idea per drill, on your browser's own JavaScript engine. Code runs in a Web Worker (no access to this page) with a time limit; module drills are real ES modules over several files; fetch reaches only a simulated API at api.fleet.example. Read the engine's own messages when a test fails." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this drill credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="js-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Drills">
        {JS_DRILLS.map((d, i) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === drill.id} className={`badge ${d.id === drill.id ? "text-amber-500" : ""}`} onClick={() => pick(d.id)} data-testid={`js-exercise-${i + 1}`}>
            {i + 1}. {d.title}
          </button>
        ))}
      </div>
      <Panel title={`${index + 1}. ${drill.title}`}>
        <p className="text-sm" data-testid="js-brief">{drill.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {drill.teaches}</p>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0">
          <Panel title={isModules ? "Your modules" : "Your code"} actions={<StatusLine status={status} detail={detail} />}>
            {isModules && (
              <div className="flex gap-1 mb-2" role="tablist" aria-label="Files">
                {fileNames.map((name) => (
                  <button key={name} type="button" role="tab" aria-selected={name === file} className={`badge font-mono ${name === file ? "text-amber-500" : ""}`} onClick={() => setFile(name)} data-testid={`js-file-${name}`}>
                    {name}
                    {name === drill.entry ? " (runs first)" : ""}
                  </button>
                ))}
              </div>
            )}
            {isModules ? (
              <PythonEditor key={file} language="javascript" value={files[file] ?? ""} onChange={(v) => setFiles((f) => ({ ...f, [file]: v }))} height="20rem" />
            ) : (
              <PythonEditor language="javascript" value={code} onChange={setCode} height="22rem" />
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn-primary" disabled={status !== "ready"} onClick={() => void run()} data-testid="js-run">
                ▶ Run the tests
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>
                Reset
              </button>
            </div>
          </Panel>
          <Panel title="Console">
            <Output result={result} />
          </Panel>
        </div>
        <div className="space-y-3 min-w-0">
          <Panel title="Tests">
            <ul className="space-y-1 text-sm" data-testid="js-tests">
              {drill.tests.map((t) => {
                const r = result?.tests.find((x) => x.id === t.id);
                const ok = r?.passed ?? false;
                return (
                  <li key={t.id} className={`${r ? (ok ? "" : "text-amber-500") : "muted"}`} data-testid={`js-test-${t.id}`} data-ok={r ? (ok ? "1" : "0") : "-"}>
                    <div className="flex gap-2">
                      <span className="shrink-0">{r ? (ok ? "✔" : "✖") : "·"}</span>
                      <span>{t.label}</span>
                    </div>
                    {r && !ok && r.error && <pre className="text-xs whitespace-pre-wrap muted ml-5 font-mono">{r.error}</pre>}
                  </li>
                );
              })}
            </ul>
            {result && <p className="text-xs muted mt-2" data-testid="js-summary">{result.error ? "The program raised before the tests could run." : `${result.tests.filter((t) => t.passed).length} of ${drill.tests.length} passed.`}</p>}
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="js-check">
              {passed ? "Passed" : allRight ? "Every test passes: mark as passed" : "Not yet: run the tests"}
            </button>
            {hint < drill.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="js-hint">
                Hint {hint + 1} of {drill.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="js-hints">
              {drill.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2 font-mono text-xs whitespace-pre-wrap">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Drill passed">
              <span data-testid="js-passed">{credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this drill yet."}</span>{" "}
              {next ? (
                <button type="button" className="underline" onClick={() => pick(next.id)}>
                  Next: {next.title}
                </button>
              ) : (
                "That was the last drill."
              )}
              {fromPath && (
                <>
                  {" "}
                  <Link to={fromPath} className="underline">Back to the unit</Link>.
                </>
              )}
            </Callout>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusLine({ status, detail }: { status: RunnerStatus; detail?: string }) {
  const text = status === "loading" ? "Starting the JavaScript worker..." : status === "ready" ? "Ready. Code runs in a Web Worker with a 6-second limit." : status === "running" ? "Running..." : status === "error" ? `The worker failed to start: ${detail ?? "unknown error"}. Reload the page.` : "Worker idle.";
  return (
    <div className="text-xs muted flex items-center gap-2" aria-live="polite" data-testid="js-status">
      <span className={`inline-block w-2 h-2 rounded-full ${status === "ready" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
      {text}
    </div>
  );
}

function Output({ result }: { result: JsRunResult | null }) {
  if (!result) return <div className="text-sm muted">Run your code to see its console output and the engine's messages here.</div>;
  const colour = (level: string) => (level === "error" ? "text-red-300" : level === "warn" ? "text-amber-200" : "");
  return (
    <div className="space-y-2">
      <div className="text-xs muted">
        Finished in {result.durationMs} ms{result.timedOut ? " (stopped)" : ""}
      </div>
      {result.logs.length > 0 ? (
        <pre className="terminal rounded p-2 text-xs whitespace-pre-wrap" data-testid="js-console">
          {result.logs.map((l, i) => (
            <div key={i} className={colour(l.level)}>
              {l.level === "warn" || l.level === "error" ? `${l.level}: ` : ""}
              {l.text}
            </div>
          ))}
        </pre>
      ) : (
        <div className="text-xs muted">(nothing logged)</div>
      )}
      {result.error && (
        <pre className="rounded p-2 text-xs whitespace-pre-wrap bg-red-950/50 text-red-200" data-testid="js-error">
          {result.error}
          {result.errorAt ? ` (${result.errorAt})` : ""}
        </pre>
      )}
    </div>
  );
}
