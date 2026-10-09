import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { ALARM_EXERCISES, ALARM_EXERCISE_BY_ID, type AlarmExercise } from "../content/study/alarmExercises";
import { nowIso } from "../data/db";
import { ALARM_METRICS, evaluateExercise, metricValue, parseAlarms, type RunVerdict } from "../engine/alarms/evaluate";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Metric alarm lab. Write alarms over the simulated platform's own metrics,
 * replay incidents and harmless moments second by second, and see which
 * alarm would have caught which incident, how fast, and which would have
 * paged for nothing. Passing credits the Study objectives curated for the
 * exercise (Guided at most).
 */
export function AlarmLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = ALARM_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? ALARM_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

const GRAMMAR = `<name>: <metric> <op> <threshold> for <n> of <m>
  fires when at least n of the last m seconds breach; add "and <condition>" for a composite alarm
  ops: > >= < <=      example: page: errorRate > 0.2 for 3 of 3 and latencyP95 > 1000 for 3 of 3`;

function ExerciseView({ exercise, fromPath, pick }: { exercise: AlarmExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [text, setText] = useState(exercise.start);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const parsed = useMemo(() => parseAlarms(text), [text]);
  const verdicts = useMemo(() => evaluateExercise(parsed.alarms, exercise.runs), [parsed, exercise]);
  const allRight = parsed.errors.length === 0 && verdicts.every((v) => v.ok);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = ALARM_EXERCISES[ALARM_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const metrics = useMemo(() => {
    const set = new Set<string>();
    for (const a of parsed.alarms) for (const c of a.conditions) set.add(c.metric);
    return [...set].slice(0, 3);
  }, [parsed]);

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Metric alarms" subtitle="Write alarms over the simulated platform's metrics, then replay incidents and harmless moments second by second. The table shows which alarm catches which incident, how fast, and which pages for nothing. The metrics and the platform are OpsForge's own." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="alarm-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {ALARM_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`alarm-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="alarm-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Alarms (one per line)">
            <textarea className="input font-mono text-xs min-h-24" value={text} onChange={(e) => setText(e.target.value)} data-testid="alarm-editable" aria-label="Alarm definitions" />
            {parsed.errors.length > 0 && (
              <ul className="text-xs text-red-500 mt-1" data-testid="alarm-errors">
                {parsed.errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <pre className="text-xs whitespace-pre-wrap mt-2 muted">{GRAMMAR}</pre>
          </Panel>
          <Panel title="Metrics you can alarm on">
            <ul className="text-xs space-y-1">
              {Object.entries(ALARM_METRICS).map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code> <span className="muted">({v.unit}): {v.help}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Runs: what must fire, what must stay quiet">
            <ul className="space-y-2" data-testid="alarm-runs">
              {verdicts.map((v) => (
                <li key={v.run.id} className={`panel-2 p-2 text-sm border ${v.ok ? "border-emerald-500/60" : "border-red-500/60"}`} data-testid={`alarm-run-${v.run.id}`} data-ok={v.ok ? "1" : "0"}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {v.run.label} <span className="badge ml-1">{v.run.kind}</span>
                      </div>
                      <div className="muted text-xs">{v.run.why}</div>
                    </div>
                  </div>
                  <ul className="text-xs mt-1 space-y-0.5">
                    {v.checks.map((c) => (
                      <li key={c.alarm} className={c.passed ? "" : "text-amber-500"} data-testid={`alarm-check-${v.run.id}-${c.alarm}`} data-ok={c.passed ? "1" : "0"}>
                        {c.passed ? "✔" : "✖"} want {c.want}: {c.detail}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn-ghost text-xs mt-1" onClick={() => setOpen(open === v.run.id ? null : v.run.id)} data-testid={`alarm-chart-toggle-${v.run.id}`}>
                    {open === v.run.id ? "Hide metrics" : "Show metrics"}
                  </button>
                  {open === v.run.id && <RunCharts verdict={v} metrics={metrics.length ? metrics : ["errorRate", "latencyP95"]} />}
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="alarm-check">
              {passed ? "Passed" : allRight ? "Every run is right: mark as passed" : "Not yet: adjust the alarms until every run matches"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="alarm-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="alarm-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="alarm-passed">{credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}</span>{" "}
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

/** Small sparklines of the alarmed metrics over the run, with the ticks in ALARM state marked. */
function RunCharts({ verdict, metrics }: { verdict: RunVerdict; metrics: string[] }) {
  const w = 300;
  const h = 48;
  return (
    <div className="mt-2 space-y-2" data-testid="alarm-charts">
      {metrics.map((m) => {
        const values = verdict.series.map((s) => metricValue(s, m) ?? 0);
        const max = Math.max(1e-9, ...values);
        const points = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(" ");
        const info = ALARM_METRICS[m];
        return (
          <div key={m} className="text-xs">
            <div className="muted">
              {info?.label ?? m}: {values[0] < 10 ? values[0].toFixed(2) : Math.round(values[0])} at 1 s, {values[values.length - 1] < 10 ? values[values.length - 1].toFixed(2) : Math.round(values[values.length - 1])} at {values.length} s, peak {max < 10 ? max.toFixed(2) : Math.round(max)} {info?.unit ?? ""}
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" role="img" aria-label={`${info?.label ?? m} over ${values.length} seconds`}>
              <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
              {verdict.results.map((r) =>
                r.firedAt !== null ? <line key={r.alarm} x1={(r.firedAt / Math.max(1, values.length - 1)) * w} x2={(r.firedAt / Math.max(1, values.length - 1)) * w} y1="0" y2={h} stroke="#f59e0b" strokeDasharray="3 2" /> : null,
              )}
            </svg>
          </div>
        );
      })}
      <div className="muted text-xs">Dashed line: first second an alarm was in ALARM state.</div>
    </div>
  );
}
