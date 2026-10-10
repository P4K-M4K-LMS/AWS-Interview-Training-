import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { COST_EXERCISES, COST_EXERCISE_BY_ID, type CostExercise } from "../content/study/costExercises";
import { nowIso } from "../data/db";
import { PRICES, checkCost, describeCostPlan, type ColdTier, type CostPlan } from "../engine/cost/model";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Cost model lab. Every price is invented and shown; the lessons are about
 * shape: commit to the floor, interruptible capacity for interruptible work,
 * storage tiers against retrieval needs, transfer paths, a cache in front of
 * egress, and the free things (a spend alarm, tags) that let anyone own the
 * bill. The cheapest plan that meets the requirement is named, so
 * over-spending fails like falling short. Passing credits Study objectives.
 */
export function CostLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = COST_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? COST_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: CostExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [plan, setPlan] = useState<CostPlan>(exercise.start);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const result = useMemo(() => checkCost(exercise.workload, exercise.requirement, plan), [exercise, plan]);
  const allRight = result.checks.every((c) => c.passed);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = COST_EXERCISES[COST_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const w = exercise.workload;
  const set = (patch: Partial<CostPlan>) => setPlan((p) => ({ ...p, ...patch }));

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Cost model" subtitle="A monthly bill in fictional credits for the fleet platform. Every price is invented and listed below; what carries over is the shape: committed capacity is paid while idle, interruptible capacity suits interruptible work, colder storage charges for retrieval and takes longer, transfer cost follows the path, and a cache moves the biggest line. The cheapest plan that meets the requirement is named, so spending too much fails as surely as falling short." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="cost-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {COST_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`cost-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="cost-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 muted" data-testid="cost-workload">
          <span>
            Compute: {w.baselineUnits} units quiet, {w.peakUnits} at peak for {w.peakHoursPerDay} h/day
          </span>
          {w.batchUnitHours > 0 && (
            <span>
              Batch: {w.batchUnitHours} unit-hours, {w.batchInterruptible ? "interruptible" : "must not be interrupted"}
            </span>
          )}
          <span>Hot data: {w.hotGb} GB</span>
          {w.coldGb > 0 && (
            <span>
              Cold data: {w.coldGb} GB, {w.coldRetrievedGb} GB read a month, needed within {w.coldRetrievalNeed}
            </span>
          )}
          <span>
            Egress: {w.egressGb} GB{w.cacheableShare ? ` (${Math.round(w.cacheableShare * 100)}% cacheable)` : ""}
          </span>
          <span>Service traffic: {w.serviceGb} GB</span>
          <span>{w.zones} zones</span>
          <span className="accent">Target ≤ {exercise.requirement.targetCredits} credits a month</span>
        </div>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Your plan" className="min-w-0 break-words">
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="label">Committed capacity units (one-year, {PRICES.committedUnitMonth} credits each, paid all month)</span>
              <input type="number" min={0} max={w.peakUnits * 3} className="input max-w-32" value={plan.commitUnits} onChange={(e) => set({ commitUnits: Math.max(0, Math.round(Number(e.target.value) || 0)) })} data-testid="cost-commit" />
            </label>
            <div>
              <span className="label">Instance size relative to need</span>
              <div className="flex gap-3">
                {([0.5, 1, 2] as const).map((f) => (
                  <label key={f} className="flex items-center gap-1">
                    <input type="radio" name="size" checked={plan.sizeFactor === f} onChange={() => set({ sizeFactor: f })} data-testid={`cost-size-${f}`} /> {f}×
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Batch compute ({PRICES.onDemandUnitHour.toFixed(3)} vs {PRICES.interruptibleUnitHour} credits per unit-hour)</span>
              <div className="flex gap-3">
                {(["on-demand", "interruptible"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1">
                    <input type="radio" name="batch" checked={plan.batchModel === m} onChange={() => set({ batchModel: m })} data-testid={`cost-batch-${m}`} /> {m}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Cold storage tier (per GB; retrieval fee; retrieval time)</span>
              <div className="flex flex-wrap gap-3">
                {(["hot", "cool", "archive"] as ColdTier[]).map((t) => (
                  <label key={t} className="flex items-center gap-1">
                    <input type="radio" name="tier" checked={plan.coldTier === t} onChange={() => set({ coldTier: t })} data-testid={`cost-tier-${t}`} /> {t} ({PRICES.storage[t]}; {PRICES.retrieval[t]}; {PRICES.retrievalSpeed[t]})
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={plan.privateEndpoint} onChange={(e) => set({ privateEndpoint: e.target.checked })} data-testid="cost-endpoint" /> Private endpoint for service traffic ({PRICES.endpointFixedPerZone}/zone + {PRICES.endpointGb}/GB instead of the translator's {PRICES.natGb}/GB)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={plan.natPerZone} onChange={(e) => set({ natPerZone: e.target.checked })} data-testid="cost-nat-per-zone" /> One address translator per zone ({PRICES.natFixed} each; avoids {PRICES.crossZoneGb}/GB cross-zone hops)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={plan.cdn} onChange={(e) => set({ cdn: e.target.checked })} data-testid="cost-cdn" /> Edge cache ({PRICES.cdnFixed} fixed + {PRICES.cdnGb}/GB served instead of {PRICES.egressGb}/GB from origin)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={plan.budgetAlarm} onChange={(e) => set({ budgetAlarm: e.target.checked })} data-testid="cost-alarm" /> Spend alarm on the monthly bill (free)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={plan.tagsFull} onChange={(e) => set({ tagsFull: e.target.checked })} data-testid="cost-tags" /> Every resource tagged with team and environment (free)
            </label>
          </div>
        </Panel>
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="The bill">
            <div className="text-2xl font-semibold" data-testid="cost-total">
              {result.derived.total} <span className="text-sm muted">credits a month</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs" data-testid="cost-lines">
              {result.derived.lines.map((l) => (
                <li key={l.item} className="flex gap-2">
                  <span className="w-16 shrink-0 text-right">{l.credits}</span>
                  <span>
                    <strong>{l.item}</strong> <span className="muted">{l.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Checks">
            <ul className="space-y-1 text-sm" data-testid="cost-checks">
              {result.checks.map((c) => (
                <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`cost-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                  <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                  <span>
                    {c.label}: <span className="muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="cost-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: adjust the plan"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="cost-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="cost-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="cost-passed">
                {describeCostPlan(plan)}. {credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}
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
