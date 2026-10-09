import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { DR_EXERCISES, DR_EXERCISE_BY_ID, type DrExercise } from "../content/study/drExercises";
import { nowIso } from "../data/db";
import { BACKUP_OPTIONS, STANDBY_OPTIONS, TRIGGER_OPTIONS, checkPlan, describePlan, fmt, type BackupCadence, type DrPlan, type Standby, type TimelineStep, type Trigger } from "../engine/dr/plan";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Disaster-recovery planner lab. Pick a backup cadence, a standby tier, a
 * failover trigger and whether the restore is drilled; the recovery point,
 * the recovery timeline and the monthly credits follow by arithmetic, the
 * checks compare them with the requirement, and the cheapest plan that fits
 * is named so over-spending shows. Passing credits the Study objectives
 * curated for the exercise (Guided at most).
 */
export function DrLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = DR_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? DR_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: DrExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [plan, setPlan] = useState<DrPlan>(exercise.start);
  const [drill, setDrill] = useState<TimelineStep["id"] | "">("");
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const result = useMemo(() => checkPlan(exercise.workload, exercise.requirement, plan), [exercise, plan]);
  const drillRight = drill !== "" && drill === result.derived.dominant;
  const allRight = result.checks.every((c) => c.passed) && drillRight;
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = DR_EXERCISES[DR_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const req = exercise.requirement;

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Recovery planner" subtitle="Given a recovery time, a recovery point and a budget, pick the backup cadence, the standby tier and the failover trigger. The recovery point is the backup interval; the recovery time is detection plus standby plus restore plus cutover; the cost is in fictional credits. The planner names the cheapest plan that fits, so spending too much fails as surely as falling short." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="dr-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {DR_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`dr-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="dr-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <div className="text-sm mt-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="dr-requirement">
          <span>
            <strong>{exercise.workload.name}</strong>: {exercise.workload.dataGb} GB, {exercise.workload.computeCredits} credits a month at full scale
          </span>
          <span>Recovery time ≤ {fmt(req.rtoMinutes)}</span>
          <span>Recovery point ≤ {fmt(req.rpoMinutes)}</span>
          <span>Budget ≤ {req.budgetCredits} credits a month</span>
        </div>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Panel title="Your plan">
            <div className="space-y-3 text-sm">
              <Choice label="Backup" value={plan.backup} options={Object.entries(BACKUP_OPTIONS).map(([k, v]) => [k, v.label, v.what])} onChange={(v) => setPlan({ ...plan, backup: v as BackupCadence })} testId="dr-backup" />
              <Choice label="Standby" value={plan.standby} options={Object.entries(STANDBY_OPTIONS).map(([k, v]) => [k, v.label, v.what])} onChange={(v) => setPlan({ ...plan, standby: v as Standby })} testId="dr-standby" />
              <Choice label="Failover" value={plan.trigger} options={Object.entries(TRIGGER_OPTIONS).map(([k, v]) => [k, v.label, v.what])} onChange={(v) => setPlan({ ...plan, trigger: v as Trigger })} testId="dr-trigger" />
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={plan.restoreTested} onChange={(e) => setPlan({ ...plan, restoreTested: e.target.checked })} data-testid="dr-tested" />
                <span>
                  <strong>Monthly restore drill.</strong> Restore from the latest backup into the standby and prove it serves. The gate asks you to describe the restore, not the backup.
                </span>
              </label>
            </div>
          </Panel>
          <Panel title="Which step dominates your recovery time?">
            <select className="input" value={drill} onChange={(e) => setDrill(e.target.value as TimelineStep["id"] | "")} data-testid="dr-drill" aria-label="Dominant step">
              <option value="">Choose a step</option>
              {result.derived.timeline.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {drill !== "" && (
              <p className="text-xs mt-1" data-testid="dr-drill-verdict">
                {drillRight ? "Right: that is the longest step of the current plan." : "Not for this plan: read the timeline again."}
              </p>
            )}
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="What the plan gives">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="panel-2 p-2">
                <div className="label">Recovery point</div>
                <div className="text-lg font-semibold" data-testid="dr-rpo">{fmt(result.derived.rpoMinutes)}</div>
              </div>
              <div className="panel-2 p-2">
                <div className="label">Recovery time</div>
                <div className="text-lg font-semibold" data-testid="dr-rto">{fmt(result.derived.rtoMinutes)}</div>
              </div>
              <div className="panel-2 p-2">
                <div className="label">Credits a month</div>
                <div className="text-lg font-semibold" data-testid="dr-cost">{result.derived.costCredits}</div>
              </div>
            </div>
            <ol className="mt-3 space-y-1 text-xs" data-testid="dr-timeline">
              {result.derived.timeline.map((s) => (
                <li key={s.id} className={`flex gap-2 ${s.id === result.derived.dominant ? "font-semibold" : ""}`}>
                  <span className="w-20 shrink-0">{fmt(s.minutes)}</span>
                  <span>
                    {s.label}: <span className="muted">{s.why}</span>
                  </span>
                </li>
              ))}
            </ol>
            <ul className="mt-3 space-y-1 text-xs muted" data-testid="dr-cost-breakdown">
              {result.derived.costBreakdown.map((c) => (
                <li key={c.item}>
                  {c.credits} {c.item}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Checks">
            <ul className="space-y-1 text-sm" data-testid="dr-checks">
              {result.checks.map((c) => (
                <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`dr-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                  <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                  <span>
                    {c.label}: <span className="muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="dr-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: adjust the plan and name the dominant step"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="dr-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="dr-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="dr-passed">
                {describePlan(plan)}. {credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}
              </span>{" "}
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

function Choice({ label, value, options, onChange, testId }: { label: string; value: string; options: Array<[string, string, string]>; onChange: (v: string) => void; testId: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="space-y-1">
        {options.map(([k, l, what]) => (
          <label key={k} className="flex items-start gap-2">
            <input type="radio" name={testId} value={k} checked={value === k} onChange={() => onChange(k)} data-testid={`${testId}-${k}`} />
            <span>
              <strong>{l}.</strong> <span className="muted">{what}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
