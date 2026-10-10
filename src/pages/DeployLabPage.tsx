import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { DEPLOY_EXERCISES, DEPLOY_EXERCISE_BY_ID, type DeployExercise } from "../content/study/deployExercises";
import { nowIso } from "../data/db";
import { checkRollout, describeStrategy, type Guard, type RolloutResult, type Strategy } from "../engine/deploy/rollout";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Deployment strategy lab. Pick how a release reaches the fleet and what
 * guards it, then watch the rollout second by second: traffic on the new
 * version, capacity in service, the error rate customers see, the alarm,
 * the rollback. Passing credits the Study objectives curated for the
 * exercise (Guided at most).
 */
export function DeployLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = DEPLOY_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? DEPLOY_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

const KINDS: Array<{ kind: Strategy["kind"]; label: string; what: string }> = [
  { kind: "all-at-once", label: "All at once", what: "Every instance restarts together. Fastest, and nothing serves while they restart." },
  { kind: "rolling", label: "Rolling batches", what: "A batch restarts at a time; the rest keeps serving. Batch size and bake time set the pace." },
  { kind: "canary", label: "Canary first", what: "A small share first, watched for a bake time; then batches. Limits exposure to the canary's share." },
  { kind: "blue-green", label: "Second fleet and switch", what: "Build a full copy, run synthetic checks, switch traffic by routing. Costs a second fleet; zero exposure to what checks can see." },
];

function withKind(s: Strategy, kind: Strategy["kind"]): Strategy {
  const batch = "batchPercent" in s ? s.batchPercent : 25;
  const bake = "bakeSeconds" in s ? s.bakeSeconds : 30;
  switch (kind) {
    case "all-at-once":
      return { kind };
    case "rolling":
      return { kind, batchPercent: batch, bakeSeconds: bake };
    case "canary":
      return { kind, canaryPercent: "canaryPercent" in s ? s.canaryPercent : 5, bakeSeconds: bake, batchPercent: batch };
    case "blue-green":
      return { kind, bakeSeconds: bake };
  }
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: DeployExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [strategy, setStrategy] = useState<Strategy>(exercise.start.strategy);
  const [guard, setGuard] = useState<Guard>(exercise.start.guard);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { result, checks } = useMemo(() => checkRollout(exercise.fleet, exercise.release, strategy, guard, exercise.requirement), [exercise, strategy, guard]);
  const allRight = checks.every((c) => c.passed);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = DEPLOY_EXERCISES[DEPLOY_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const req = exercise.requirement;
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Deployment strategies" subtitle="How a release reaches the fleet, and what guards it. The rollout runs second by second: traffic on the new version, the share of the fleet in service, the error rate customers see, the alarm, the rollback. Restarting instances serve nothing; the rest absorb the load up to the fleet's headroom. Vendor-neutral; the numbers are the platform's own." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="deploy-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {DEPLOY_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`deploy-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="deploy-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 muted" data-testid="deploy-setup">
          <span>Release: {exercise.release.name}</span>
          <span>
            Fleet: {exercise.fleet.requestsPerSec} req/s, {exercise.fleet.restartSeconds} s restart, {Math.round(exercise.fleet.headroom * 100)}% headroom, {exercise.fleet.buildSeconds} s to build a second fleet
          </span>
          <span className="accent">
            Keep ≥ {Math.round(req.minCapacityShare * 100)}% in service · ≤ {req.failedRequestsBudget} failed requests · done within {req.finishWithinSeconds} s · second fleet ≤ {req.extraFleetSecondsBudget} fleet-seconds
          </span>
        </div>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Strategy">
            <div className="space-y-2 text-sm">
              {KINDS.map((k) => (
                <label key={k.kind} className="flex items-start gap-2">
                  <input type="radio" name="kind" checked={strategy.kind === k.kind} onChange={() => setStrategy((s) => withKind(s, k.kind))} data-testid={`deploy-kind-${k.kind}`} />
                  <span>
                    <strong>{k.label}.</strong> <span className="muted">{k.what}</span>
                  </span>
                </label>
              ))}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {"canaryPercent" in strategy && (
                  <label className="block">
                    <span className="label">Canary %</span>
                    <input type="number" min={1} max={50} className="input" value={strategy.canaryPercent} onChange={(e) => setStrategy({ ...strategy, canaryPercent: num(e.target.value, 1, 50) })} data-testid="deploy-canary" />
                  </label>
                )}
                {"batchPercent" in strategy && (
                  <label className="block">
                    <span className="label">Batch %</span>
                    <input type="number" min={1} max={100} className="input" value={strategy.batchPercent} onChange={(e) => setStrategy({ ...strategy, batchPercent: num(e.target.value, 1, 100) })} data-testid="deploy-batch" />
                  </label>
                )}
                {"bakeSeconds" in strategy && (
                  <label className="block">
                    <span className="label">{strategy.kind === "blue-green" ? "Synthetic checks (s)" : "Bake (s)"}</span>
                    <input type="number" min={0} max={600} className="input" value={strategy.bakeSeconds} onChange={(e) => setStrategy({ ...strategy, bakeSeconds: num(e.target.value, 0, 600) })} data-testid="deploy-bake" />
                  </label>
                )}
              </div>
            </div>
          </Panel>
          <Panel title="Guard">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="block">
                <span className="label">Alarm when error rate exceeds (%)</span>
                <input type="number" min={0} max={100} step={0.5} className="input" value={Math.round(guard.alarmErrorRate * 1000) / 10} onChange={(e) => setGuard({ ...guard, alarmErrorRate: Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)) })} data-testid="deploy-alarm-rate" />
              </label>
              <label className="block">
                <span className="label">for this many seconds</span>
                <input type="number" min={1} max={120} className="input" value={guard.evaluationSeconds} onChange={(e) => setGuard({ ...guard, evaluationSeconds: num(e.target.value, 1, 120) })} data-testid="deploy-alarm-seconds" />
              </label>
              <label className="flex items-center gap-2 col-span-2">
                <input type="checkbox" checked={guard.autoRollback} onChange={(e) => setGuard({ ...guard, autoRollback: e.target.checked })} data-testid="deploy-auto-rollback" /> Roll back automatically when the alarm fires
              </label>
            </div>
          </Panel>
        </div>
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="What happened">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="panel-2 p-2">
                <div className="label">Outcome</div>
                <div className="font-semibold" data-testid="deploy-outcome">
                  {result.rolledBack ? `Rolled back at ${result.finishedAt} s` : result.completed ? `Completed at ${result.finishedAt} s` : "Still going"}
                </div>
              </div>
              <div className="panel-2 p-2">
                <div className="label">Failed requests</div>
                <div className="font-semibold" data-testid="deploy-failed">{result.failedRequests}</div>
              </div>
              <div className="panel-2 p-2">
                <div className="label">Lowest fleet in service</div>
                <div className="font-semibold" data-testid="deploy-mincap">{Math.round(result.minCapacityShare * 100)}%</div>
              </div>
              <div className="panel-2 p-2">
                <div className="label">Alarm</div>
                <div className="font-semibold" data-testid="deploy-alarm">{result.alarmAt === null ? "never fired" : `fired at ${result.alarmAt + 1} s`}</div>
              </div>
            </div>
            <Timeline result={result} />
          </Panel>
          <Panel title="Checks">
            <ul className="space-y-1 text-sm" data-testid="deploy-checks">
              {checks.map((c) => (
                <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`deploy-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                  <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                  <span>
                    {c.label}: <span className="muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="deploy-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: change the strategy or the guard"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="deploy-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="deploy-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="deploy-passed">
                {describeStrategy(strategy)}. {credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}
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

/** Three stacked sparklines: traffic on the new version, fleet in service, customer error rate; alarm marked. */
function Timeline({ result }: { result: RolloutResult }) {
  const w = 320;
  const h = 36;
  const n = Math.max(2, result.ticks.length);
  const line = (pickV: (t: RolloutResult["ticks"][number]) => number) => result.ticks.map((t, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - pickV(t) * (h - 4) - 2).toFixed(1)}`).join(" ");
  const rows: Array<[string, (t: RolloutResult["ticks"][number]) => number]> = [
    ["Traffic on the new version", (t) => t.shareNew],
    ["Fleet in service", (t) => t.capacityShare],
    ["Error rate customers see", (t) => t.errorRate],
  ];
  const phases = [...new Set(result.ticks.map((t) => t.phase))];
  return (
    <div className="mt-3 space-y-1" data-testid="deploy-timeline">
      {rows.map(([label, pickV]) => (
        <div key={label} className="text-xs">
          <div className="muted">{label}</div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" role="img" aria-label={`${label} over ${result.ticks.length} seconds`}>
            <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={line(pickV)} />
            {result.alarmAt !== null && <line x1={(result.alarmAt / (n - 1)) * w} x2={(result.alarmAt / (n - 1)) * w} y1="0" y2={h} stroke="#f59e0b" strokeDasharray="3 2" />}
          </svg>
        </div>
      ))}
      <div className="muted text-xs">
        {result.ticks.length} s shown. Phases: {phases.join(" → ")}. Dashed line: alarm.
      </div>
    </div>
  );
}
