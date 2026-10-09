import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RunnerStatusLine, usePythonRunner } from "../components/PythonRunPanel";
import { Callout, PageHeader, Panel } from "../components/ui";
import { SQL_EXERCISES, SQL_EXERCISE_BY_ID, type SqlExercise } from "../content/study/sqlExercises";
import { nowIso } from "../data/db";
import { buildProgram, parseResult, type SqlRunResult } from "../engine/sql/harness";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * SQL lab. Real SQL on the Python runtime's bundled SQLite: the exercise's
 * schema is seeded into an in-memory database, the learner's statements run
 * one by one, and the page shows the rows of the last query, the query plan
 * SQLite chose, and the indexes and views that exist afterwards. Checks read
 * those; passing credits the Study objectives curated for the exercise
 * (Guided at most).
 */
export function SqlLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = SQL_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? SQL_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: SqlExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [sql, setSql] = useState(exercise.start);
  const [result, setResult] = useState<SqlRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { runner, status, detail } = usePythonRunner();
  const checks = useMemo(() => (result ? exercise.checks(result) : null), [exercise, result]);
  const allRight = checks !== null && checks.every((c) => c.passed);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = SQL_EXERCISES[SQL_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const schemaLines = exercise.setup
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^CREATE (TABLE|INDEX|VIEW)/i.test(l));

  async function run() {
    setRunError(null);
    const r = await runner.run({ code: buildProgram(exercise.setup, sql) });
    if (r.error) {
      setResult(null);
      setRunError(r.error);
      return;
    }
    const parsed = parseResult(r.stdout);
    if (!parsed) {
      setResult(null);
      setRunError("The runtime returned no result. Reload the page and try again.");
      return;
    }
    setResult(parsed);
  }

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="SQL" subtitle="Real SQL on a real database engine: the exercise's schema is loaded into an in-memory SQLite inside the Python runtime, your statements run one by one, and you see the rows, the query plan the engine chose, and the indexes and views you created. The data is fictional." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="sql-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {SQL_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`sql-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="sql-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer muted">Schema</summary>
          <pre className="terminal rounded p-2 mt-1 whitespace-pre-wrap" data-testid="sql-schema">{schemaLines.join("\n")}</pre>
        </details>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Panel title="Statements" actions={<RunnerStatusLine status={status} detail={detail} version={runner.version} />}>
            <textarea className="input font-mono text-sm w-full" rows={12} spellCheck={false} value={sql} onChange={(e) => setSql(e.target.value)} aria-label="SQL statements" data-testid="sql-program" />
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn-primary" disabled={status !== "ready"} onClick={() => void run()} data-testid="sql-run">
                ▶ Run
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSql(exercise.start)}>
                Reset
              </button>
            </div>
            {runError && <pre className="rounded p-2 mt-2 text-xs whitespace-pre-wrap bg-red-950/50 text-red-200" data-testid="sql-run-error">{runError}</pre>}
          </Panel>
          <Panel title="Query plan">
            {result?.plan.length ? (
              <ol className="text-xs font-mono space-y-0.5" data-testid="sql-plan">
                {result.plan.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm muted">{result ? "No query ran, so no plan." : "Run to see the plan SQLite chose for your last query."}</p>
            )}
            {result && (result.indexes.length > 0 || result.views.length > 0) && (
              <p className="text-xs muted mt-2" data-testid="sql-objects">
                {result.indexes.length ? `Indexes created: ${result.indexes.map((i) => `${i.name} on ${i.table}`).join(", ")}. ` : ""}
                {result.views.length ? `Views created: ${result.views.join(", ")}.` : ""}
              </p>
            )}
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="Rows">
            {result === null ? (
              <p className="text-sm muted">Nothing ran yet.</p>
            ) : result.error ? (
              <pre className="rounded p-2 text-xs whitespace-pre-wrap bg-red-950/50 text-red-200" data-testid="sql-error">
                statement {result.errorStatement}: {result.error}
              </pre>
            ) : result.columns.length === 0 ? (
              <p className="text-sm muted" data-testid="sql-no-rows">
                {result.statements} statement{result.statements === 1 ? "" : "s"} ran; the last one returned no rows.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs w-full" data-testid="sql-rows">
                  <thead>
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c} className="text-left pr-3 pb-1 muted">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} data-testid={`sql-row-${i}`}>
                        {r.map((v, j) => (
                          <td key={j} className="pr-3 font-mono">
                            {v === null ? "NULL" : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs muted mt-1">
                  {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
                  {result.rows.length > 50 ? ", first 50 shown" : ""}
                  {result.rows.length >= 200 ? " (capped at 200)" : ""}
                </p>
              </div>
            )}
          </Panel>
          <Panel title="Checks">
            {checks === null ? (
              <p className="text-sm muted">Run your statements to check them.</p>
            ) : (
              <ul className="space-y-1 text-sm" data-testid="sql-checks">
                {checks.map((c) => (
                  <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`sql-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                    <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                    <span>
                      {c.label}
                      {c.detail && !c.passed ? <span className="muted">: {c.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="sql-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: change the statements and run again"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="sql-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="sql-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2 font-mono text-xs whitespace-pre-wrap">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="sql-passed">{credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}</span>{" "}
              {next ? (
                <button type="button" className="underline" onClick={() => pick(next.id)}>
                  Next: {next.title}
                </button>
              ) : (
                "That was the last exercise."
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
