import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { AUTOSCALE_EXERCISES, AUTOSCALE_EXERCISE_BY_ID, type AutoscaleExercise } from "../content/study/autoscaleExercises";
import { nowIso } from "../data/db";
import { checkScaling, describeConfig, EVALUATION_SECONDS, type Config, type Metric, type Outcome, type Policy } from "../engine/autoscale/simulate";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Autoscaling lab. Configure the fleet's bounds, policy, schedule and health
 * checks and watch demand against capacity second by second: failed
 * requests, slow seconds, instance-seconds, scaling actions and healthy
 * instances thrown away by health checks. Passing credits the Study
 * objectives curated for the exercise (Guided at most).
 */
export function AutoscaleLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = AUTOSCALE_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? AUTOSCALE_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

const POLICIES: Array<{ kind: Policy["kind"]; label: string; what: string }> = [
  { kind: "none", label: "No policy", what: "The fleet stays at its minimum. Size it by hand." },
  { kind: "target", label: "Target tracking", what: `Keep a metric near a target: add instances when it is above, remove them when it is below and the scale-in cooldown has passed. Evaluated every ${EVALUATION_SECONDS} s.` },
  { kind: "step", label: "Step scaling", what: "Add a fixed number after the metric has been above a line for the evaluation period; remove a fixed number after it has been below another line. A cooldown separates actions." },
];

function withKind(p: Policy, kind: Policy["kind"]): Policy {
  const metric: Metric = p.kind === "none" ? "cpu" : p.metric;
  switch (kind) {
    case "none":
      return { kind };
    case "target":
      return p.kind === "target" ? p : { kind, metric, target: metric === "cpu" ? 0.7 : 14, countWarming: true, scaleInCooldownSeconds: 300 };
    case "step":
      return p.kind === "step" ? p : { kind, metric, up: { above: metric === "cpu" ? 0.8 : 16, add: 2 }, down: { below: metric === "cpu" ? 0.5 : 10, remove: 2 }, evaluationSeconds: 60, cooldownSeconds: 300 };
  }
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: AutoscaleExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [config, setConfig] = useState<Config>(exercise.start);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { outcome, checks } = useMemo(() => checkScaling(exercise.scenario, config, exercise.requirement), [exercise, config]);
  const allRight = checks.every((c) => c.passed);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = AUTOSCALE_EXERCISES[AUTOSCALE_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const { fleet, demand, faults, flapEveryNthCheck } = exercise.scenario;
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo));
  const int = (v: string, lo: number, hi: number) => Math.round(num(v, lo, hi));
  const p = config.policy;
  const setPolicy = (policy: Policy) => setConfig({ ...config, policy });
  const metricUnit = (m: Metric) => (m === "cpu" ? "% CPU" : "req/s per instance");
  const toMetric = (m: Metric, v: number) => (m === "cpu" ? Math.round(v * 100) : v);
  const fromMetric = (m: Metric, v: string) => (m === "cpu" ? num(v, 1, 100) / 100 : num(v, 1, 100));

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Autoscaling" subtitle="A fleet behind a load balancer, scaled by a policy, second by second. Demand is a curve; each instance serves a fixed rate once it has warmed up; the balancer spreads requests over every instance it believes is in service, hung ones included until health checks give up on them. The outcome counts what the configuration costs: failed requests, slow seconds, instance-seconds, scaling actions, healthy instances thrown away. Vendor-neutral; the numbers are the platform's own." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="autoscale-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {AUTOSCALE_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`autoscale-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="autoscale-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 muted" data-testid="autoscale-setup">
          <span>
            Instance: {fleet.perInstanceRps} req/s, {fleet.warmupSeconds} s warm-up, {Math.round(fleet.cpuAtCapacity * 100)}% CPU at full capacity
          </span>
          <span>Demand: {demand.map((d) => `${d.rps}/s at ${d.at} s`).join(" → ")}</span>
          {faults.length > 0 && <span>Faults: {faults.map((f) => `${f.instances} instance${f.instances === 1 ? "" : "s"} hang at ${f.at} s`).join("; ")}</span>}
          {flapEveryNthCheck !== null && <span>One instance fails every {flapEveryNthCheck}th health check once.</span>}
        </div>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Panel title="Fleet bounds">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="block">
                <span className="label">Minimum instances</span>
                <input type="number" min={1} max={100} className="input" value={config.min} onChange={(e) => setConfig({ ...config, min: int(e.target.value, 1, 100), max: Math.max(config.max, int(e.target.value, 1, 100)) })} data-testid="autoscale-min" />
              </label>
              <label className="block">
                <span className="label">Maximum instances</span>
                <input type="number" min={1} max={100} className="input" value={config.max} onChange={(e) => setConfig({ ...config, max: Math.max(config.min, int(e.target.value, 1, 100)) })} data-testid="autoscale-max" />
              </label>
            </div>
          </Panel>
          <Panel title="Policy">
            <div className="space-y-2 text-sm">
              {POLICIES.map((k) => (
                <label key={k.kind} className="flex items-start gap-2">
                  <input type="radio" name="policy" checked={p.kind === k.kind} onChange={() => setPolicy(withKind(p, k.kind))} data-testid={`autoscale-policy-${k.kind}`} />
                  <span>
                    <strong>{k.label}.</strong> <span className="muted">{k.what}</span>
                  </span>
                </label>
              ))}
            </div>
            {p.kind !== "none" && (
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <label className="block col-span-2">
                  <span className="label">Metric</span>
                  <select
                    className="input"
                    value={p.metric}
                    onChange={(e) => {
                      const metric = e.target.value as Metric;
                      if (p.kind === "target") setPolicy({ ...p, metric, target: metric === "cpu" ? 0.7 : 14 });
                      else setPolicy({ ...p, metric, up: { ...p.up, above: metric === "cpu" ? 0.8 : 16 }, down: { ...p.down, below: metric === "cpu" ? 0.5 : 10 } });
                    }}
                    data-testid="autoscale-metric"
                  >
                    <option value="cpu">CPU utilisation</option>
                    <option value="requests">Requests per instance</option>
                  </select>
                </label>
                {p.kind === "target" && (
                  <>
                    <label className="block">
                      <span className="label">Target ({metricUnit(p.metric)})</span>
                      <input type="number" min={1} max={100} className="input" value={toMetric(p.metric, p.target)} onChange={(e) => setPolicy({ ...p, target: fromMetric(p.metric, e.target.value) })} data-testid="autoscale-target" />
                    </label>
                    <label className="block">
                      <span className="label">Scale-in cooldown (s)</span>
                      <input type="number" min={0} max={3600} className="input" value={p.scaleInCooldownSeconds} onChange={(e) => setPolicy({ ...p, scaleInCooldownSeconds: int(e.target.value, 0, 3600) })} data-testid="autoscale-scalein-cooldown" />
                    </label>
                    <label className="flex items-center gap-2 col-span-2">
                      <input type="checkbox" checked={p.countWarming} onChange={(e) => setPolicy({ ...p, countWarming: e.target.checked })} data-testid="autoscale-count-warming" /> Count instances still warming up as capacity on its way
                    </label>
                  </>
                )}
                {p.kind === "step" && (
                  <>
                    <label className="block">
                      <span className="label">Add when above ({metricUnit(p.metric)})</span>
                      <input type="number" min={1} max={100} className="input" value={toMetric(p.metric, p.up.above)} onChange={(e) => setPolicy({ ...p, up: { ...p.up, above: fromMetric(p.metric, e.target.value) } })} data-testid="autoscale-step-above" />
                    </label>
                    <label className="block">
                      <span className="label">Instances to add</span>
                      <input type="number" min={1} max={20} className="input" value={p.up.add} onChange={(e) => setPolicy({ ...p, up: { ...p.up, add: int(e.target.value, 1, 20) } })} data-testid="autoscale-step-add" />
                    </label>
                    <label className="block">
                      <span className="label">Remove when below ({metricUnit(p.metric)})</span>
                      <input type="number" min={0} max={100} className="input" value={toMetric(p.metric, p.down.below)} onChange={(e) => setPolicy({ ...p, down: { ...p.down, below: fromMetric(p.metric, e.target.value) } })} data-testid="autoscale-step-below" />
                    </label>
                    <label className="block">
                      <span className="label">Instances to remove</span>
                      <input type="number" min={1} max={20} className="input" value={p.down.remove} onChange={(e) => setPolicy({ ...p, down: { ...p.down, remove: int(e.target.value, 1, 20) } })} data-testid="autoscale-step-remove" />
                    </label>
                    <label className="block">
                      <span className="label">Evaluation period (s)</span>
                      <input type="number" min={1} max={600} className="input" value={p.evaluationSeconds} onChange={(e) => setPolicy({ ...p, evaluationSeconds: int(e.target.value, 1, 600) })} data-testid="autoscale-step-evaluation" />
                    </label>
                    <label className="block">
                      <span className="label">Cooldown (s)</span>
                      <input type="number" min={0} max={3600} className="input" value={p.cooldownSeconds} onChange={(e) => setPolicy({ ...p, cooldownSeconds: int(e.target.value, 0, 3600) })} data-testid="autoscale-step-cooldown" />
                    </label>
                  </>
                )}
              </div>
            )}
          </Panel>
          <Panel title="Scheduled minimum">
            <ul className="space-y-1 text-sm" data-testid="autoscale-schedule">
              {config.schedule.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="muted">At</span>
                  <input type="number" min={0} max={exercise.scenario.seconds} className="input w-24" value={s.at} onChange={(e) => setConfig({ ...config, schedule: config.schedule.map((x, j) => (j === i ? { ...x, at: int(e.target.value, 0, exercise.scenario.seconds) } : x)) })} data-testid={`autoscale-schedule-at-${i}`} />
                  <span className="muted">s, minimum</span>
                  <input type="number" min={0} max={100} className="input w-24" value={s.minimum} onChange={(e) => setConfig({ ...config, schedule: config.schedule.map((x, j) => (j === i ? { ...x, minimum: int(e.target.value, 0, 100) } : x)) })} data-testid={`autoscale-schedule-min-${i}`} />
                  <button type="button" className="btn-secondary" onClick={() => setConfig({ ...config, schedule: config.schedule.filter((_, j) => j !== i) })} data-testid={`autoscale-schedule-remove-${i}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-secondary mt-2" onClick={() => setConfig({ ...config, schedule: [...config.schedule, { at: 0, minimum: config.min }] })} data-testid="autoscale-schedule-add">
              Add a scheduled action
            </button>
          </Panel>
          <Panel title="Health checks">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="block">
                <span className="label">Interval (s)</span>
                <input type="number" min={5} max={300} className="input" value={config.healthCheck.intervalSeconds} onChange={(e) => setConfig({ ...config, healthCheck: { ...config.healthCheck, intervalSeconds: int(e.target.value, 5, 300) } })} data-testid="autoscale-hc-interval" />
              </label>
              <label className="block">
                <span className="label">Unhealthy after this many failures</span>
                <input type="number" min={1} max={10} className="input" value={config.healthCheck.unhealthyThreshold} onChange={(e) => setConfig({ ...config, healthCheck: { ...config.healthCheck, unhealthyThreshold: int(e.target.value, 1, 10) } })} data-testid="autoscale-hc-threshold" />
              </label>
            </div>
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="What happened">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Failed requests" value={outcome.failedRequests.toLocaleString()} id="failed" />
              <Stat label="Slow seconds" value={String(outcome.slowSeconds)} id="slow" />
              <Stat label="Instance-seconds" value={outcome.instanceSeconds.toLocaleString()} id="cost" />
              <Stat label="Scaling actions" value={String(outcome.scaleActions)} id="actions" />
              <Stat label="Peak instances" value={String(outcome.peakInstances)} id="peak" />
              <Stat label="Healthy removed" value={String(outcome.healthyRemoved)} id="churn" />
            </div>
            <Timeline outcome={outcome} />
          </Panel>
          <Panel title="Checks">
            <ul className="space-y-1 text-sm" data-testid="autoscale-checks">
              {checks.map((c) => (
                <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`autoscale-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                  <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                  <span>
                    {c.label}: <span className="muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="autoscale-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: change the configuration"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="autoscale-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="autoscale-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="autoscale-passed">
                {describeConfig(config)}. {credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}
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

function Stat({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="panel-2 p-2">
      <div className="label">{label}</div>
      <div className="font-semibold" data-testid={`autoscale-${id}`}>
        {value}
      </div>
    </div>
  );
}

/** Demand against capacity, and the instance count beneath. */
function Timeline({ outcome }: { outcome: Outcome }) {
  const w = 320;
  const h = 48;
  const n = Math.max(2, outcome.ticks.length);
  const maxRps = Math.max(1, ...outcome.ticks.map((t) => Math.max(t.demand, t.capacity)));
  const maxInst = Math.max(1, ...outcome.ticks.map((t) => t.serving + t.warming));
  const line = (pickV: (t: Outcome["ticks"][number]) => number, max: number) => outcome.ticks.map((t, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (pickV(t) / max) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <div className="mt-3 space-y-1 text-xs" data-testid="autoscale-timeline">
      <div className="muted">Demand (amber) against capacity in service (grey), requests per second</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" role="img" aria-label={`Demand against capacity over ${outcome.ticks.length} seconds`}>
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={line((t) => t.capacity, maxRps)} opacity="0.6" />
        <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={line((t) => t.demand, maxRps)} />
      </svg>
      <div className="muted">Instances: in service (grey) and including warming (amber)</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" role="img" aria-label={`Instances over ${outcome.ticks.length} seconds, peak ${outcome.peakInstances}`}>
        <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={line((t) => t.serving + t.warming, maxInst)} />
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={line((t) => t.serving, maxInst)} opacity="0.6" />
      </svg>
      <div className="muted">{outcome.ticks.length} s shown.</div>
    </div>
  );
}
