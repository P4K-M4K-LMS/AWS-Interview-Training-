import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PythonEditor } from "../components/PythonEditor";
import { RunOutput, RunnerStatusLine, usePythonRunner } from "../components/PythonRunPanel";
import { Callout, PageHeader, Panel } from "../components/ui";
import { PYTHON_DRILLS, PYTHON_DRILL_BY_ID, type PythonDrill } from "../content/study/pythonDrills";
import { nowIso } from "../data/db";
import type { PyRunResult } from "../engine/python/execute";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Python drills: one idea per drill, checked by assertions that run in the
 * learner's namespace on the real interpreter. Passing every test credits
 * the Study objectives curated for the drill (Guided at most).
 */
export function PythonDrillsLabPage() {
  const [params, setParams] = useSearchParams();
  const drill = PYTHON_DRILL_BY_ID.get(params.get("exercise") ?? "") ?? PYTHON_DRILLS[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <DrillView key={drill.id} drill={drill} fromPath={fromPath} pick={pick} />;
}

function DrillView({ drill, fromPath, pick }: { drill: PythonDrill; fromPath: string | null; pick: (id: string) => void }) {
  const [code, setCode] = useState(drill.starter);
  const [result, setResult] = useState<PyRunResult | null>(null);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { runner, status, detail } = usePythonRunner();
  const allRight = result !== null && result.error === null && result.tests.length === drill.tests.length && result.tests.every((t) => t.passed);
  const credited = objectivesCreditedByExercise(drill.id);
  const index = PYTHON_DRILLS.findIndex((d) => d.id === drill.id);
  const next = PYTHON_DRILLS[index + 1];
  const labelOf = (id: string) => drill.tests.find((t) => t.id === id)?.label ?? id;

  async function run() {
    setResult(await runner.run({ code, tests: drill.tests.map((t) => ({ id: t.id, code: t.code })) }));
  }

  async function check() {
    if (!allRight) return;
    await creditLabExercise(drill.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Python drills" subtitle="One idea per drill, on the real interpreter. Write the functions the brief asks for, run the tests, and read the interpreter's own messages when one fails. Nothing is simulated." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this drill credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="pydrill-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Drills">
        {PYTHON_DRILLS.map((d, i) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === drill.id} className={`badge ${d.id === drill.id ? "text-amber-500" : ""}`} onClick={() => pick(d.id)} data-testid={`pydrill-exercise-${i + 1}`}>
            {i + 1}. {d.title}
          </button>
        ))}
      </div>
      <Panel title={`${index + 1}. ${drill.title}`}>
        <p className="text-sm" data-testid="pydrill-brief">{drill.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {drill.teaches}</p>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Your code" actions={<RunnerStatusLine status={status} detail={detail} version={runner.version} />}>
            <PythonEditor value={code} onChange={setCode} height="22rem" />
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn-primary" disabled={status !== "ready"} onClick={() => void run()} data-testid="pydrill-run">
                ▶ Run the tests
              </button>
              <button type="button" className="btn-ghost" onClick={() => setCode(drill.starter)}>
                Reset
              </button>
            </div>
          </Panel>
          <Panel title="Output">
            <RunOutput result={result ? { ...result, tests: result.tests.map((t) => ({ ...t, id: labelOf(t.id) })) } : null} />
          </Panel>
        </div>
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Tests">
            <ul className="space-y-1 text-sm" data-testid="pydrill-tests">
              {drill.tests.map((t) => {
                const r = result?.tests.find((x) => x.id === t.id);
                const ok = r?.passed ?? false;
                return (
                  <li key={t.id} className={`flex gap-2 ${r ? (ok ? "" : "text-amber-500") : "muted"}`} data-testid={`pydrill-test-${t.id}`} data-ok={r ? (ok ? "1" : "0") : "-"}>
                    <span className="shrink-0">{r ? (ok ? "✔" : "✖") : "·"}</span>
                    <span className="font-mono text-xs">{t.label}</span>
                  </li>
                );
              })}
            </ul>
            {result && <p className="text-xs muted mt-2" data-testid="pydrill-summary">{result.error ? "The program raised before the tests could run." : `${result.tests.filter((t) => t.passed).length} of ${drill.tests.length} passed.`}</p>}
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="pydrill-check">
              {passed ? "Passed" : allRight ? "Every test passes: mark as passed" : "Not yet: run the tests"}
            </button>
            {hint < drill.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="pydrill-hint">
                Hint {hint + 1} of {drill.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="pydrill-hints">
              {drill.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2 font-mono text-xs whitespace-pre-wrap">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Drill passed">
              <span data-testid="pydrill-passed">{credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this drill yet."}</span>{" "}
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
