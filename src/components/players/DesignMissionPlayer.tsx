import { useMemo, useState } from "react";
import type { DesignMission, MissionProgress } from "../../domain/types";
import { emptyDesign, evaluateDesign, type DesignState } from "../../engine/design/evaluate";
import { recordAttempt, saveMissionState } from "../../engine/missions/engine";
import { MissionFrame } from "./MissionFrame";
import { Callout, Panel } from "../ui";

interface Props {
  mission: DesignMission;
  progress: MissionProgress | undefined;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  retention?: boolean;
  onGiveUp?: () => void;
}

/**
 * Design exercise: requirements in, a justified design out. Every check is
 * computed from the chosen options' numbers by the transparent rubric; the
 * consequences panel shows the same arithmetic live so the learner can see
 * why a check fails before asking for a hint.
 */
export function DesignMissionPlayer({ mission, progress, completed, onComplete, onReset, retention, onGiveUp }: Props) {
  const saved = progress?.savedState as DesignState | undefined;
  const [state, setState] = useState<DesignState>(() => (saved?.choices ? saved : emptyDesign()));
  const { checks, derived } = useMemo(() => evaluateDesign(mission, state), [mission, state]);
  const r = mission.requirements;

  const update = (patch: Partial<DesignState>) => {
    const next = { ...state, ...patch };
    setState(next);
    void saveMissionState(mission.id, next);
    const ev = evaluateDesign(mission, next);
    void recordAttempt(mission.id, ev.checks.filter((c) => c.passed).length / ev.checks.length);
  };

  return (
    <MissionFrame
      mission={mission}
      progress={progress}
      retention={retention}
      onGiveUp={onGiveUp}
      checks={checks}
      completed={completed}
      onComplete={onComplete}
      onReset={() => {
        setState(emptyDesign());
        onReset();
      }}
      workstation={
        <div className="space-y-4">
          <Panel title="Requirements">
            <ul className="list-disc pl-5 text-sm space-y-1">
              {r.functional.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-sm">
              <div className="panel-2 p-2">
                <div className="label">Peak ingest</div>
                {r.peakIngestPerSec.toLocaleString()} events/s
              </div>
              <div className="panel-2 p-2">
                <div className="label">Read latency budget</div>
                {r.maxReadLatencyMs} ms p95
              </div>
              <div className="panel-2 p-2">
                <div className="label">Budget</div>
                {r.budget.toLocaleString()} / month
              </div>
              <div className="panel-2 p-2">
                <div className="label">Availability and durability</div>
                No SPOF on the {r.noSpofOn.join(" and ")} path{r.noSpofOn.length > 1 ? "s" : ""}
                {r.durableWrites ? "; events survive a storage outage" : ""}
              </div>
            </div>
          </Panel>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-4">
            <Panel title="Components">
              <div className="space-y-4">
                {mission.slots.map((slot) => (
                  <fieldset key={slot.id} data-testid={`slot-${slot.id}`}>
                    <legend className="text-sm font-medium mb-1">
                      {slot.label}: {slot.prompt}
                    </legend>
                    <div className="grid md:grid-cols-3 gap-2">
                      {slot.options.map((o) => {
                        const chosen = state.choices[slot.id] === o.id;
                        return (
                          <label key={o.id} className={`block rounded-md border p-2 text-sm cursor-pointer ${chosen ? "border-amber-500" : ""}`} style={{ borderColor: chosen ? undefined : "var(--border)" }}>
                            <input type="radio" name={`slot-${slot.id}`} className="mr-2" checked={chosen} disabled={completed} onChange={() => update({ choices: { ...state.choices, [slot.id]: o.id } })} data-testid={`opt-${slot.id}-${o.id}`} />
                            <span className="font-medium">{o.name}</span>
                            <p className="text-xs muted mt-1">{o.description}</p>
                            <p className="text-xs mt-1 font-mono">
                              {o.cost}/mo{o.capacity !== undefined ? ` · ${o.capacity.toLocaleString()}/s` : ""}
                              {o.latencyMs !== undefined ? ` · ${o.latencyMs} ms` : ""}
                              {o.consistency ? ` · ${o.consistency}` : ""}
                              {o.spof ? " · SPOF" : ""}
                              {o.durable ? " · durable" : ""}
                            </p>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </Panel>
            <Panel title="Consequences of your design">
              <dl className="text-sm space-y-1" data-testid="design-derived">
                <div className="flex justify-between">
                  <dt className="muted">Monthly cost</dt>
                  <dd className={derived.cost > r.budget ? "text-red-400" : ""}>{derived.cost.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Write-path capacity</dt>
                  <dd className={derived.complete && derived.ingestCapacity < r.peakIngestPerSec ? "text-red-400" : ""}>{derived.complete ? `${derived.ingestCapacity.toLocaleString()}/s` : "incomplete"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Read latency</dt>
                  <dd className={derived.readLatencyMs > r.maxReadLatencyMs ? "text-red-400" : ""}>{derived.complete ? `${derived.readLatencyMs} ms` : "incomplete"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Single points of failure</dt>
                  <dd className={derived.spofs.length ? "text-red-400" : ""}>{derived.spofs.length ? derived.spofs.map((s) => `${s.option} (${s.path})`).join("; ") : "none"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Events survive storage outage</dt>
                  <dd className={derived.complete && !derived.durable ? "text-red-400" : ""}>{derived.durable ? "yes" : "no"}</dd>
                </div>
              </dl>
              <p className="text-xs muted mt-2">Computed from the options' numbers: cost is a sum, capacity is the weakest write-path component, latency is the sum of read-path hops.</p>
            </Panel>
          </div>

          <Panel title="Sizing">
            <div className="space-y-3">
              {mission.quantities.map((q) => (
                <div key={q.id} className="text-sm">
                  <label htmlFor={`qty-${q.id}`} className="block mb-1">
                    {q.prompt}
                  </label>
                  <div className="flex items-center gap-2">
                    <input id={`qty-${q.id}`} type="number" className="input w-32" disabled={completed} value={state.quantities[q.id] ?? ""} onChange={(e) => update({ quantities: { ...state.quantities, [q.id]: e.target.value === "" ? NaN : Number(e.target.value) } })} data-testid={`qty-${q.id}`} />
                    <span className="text-xs muted">{q.unit}</span>
                    {checks.find((c) => c.id === `qty-${q.id}`)?.passed && <span className="text-xs text-emerald-400">✓ {q.explanation}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Failure drills (answers depend on your design)">
            <div className="space-y-4">
              {mission.drills.map((drill) => {
                const check = checks.find((c) => c.id === `drill-${drill.id}`);
                return (
                  <fieldset key={drill.id} className="text-sm">
                    <legend className="font-medium mb-1">{drill.prompt}</legend>
                    <div className="space-y-1">
                      {drill.options.map((o, i) => (
                        <label key={i} className="flex items-start gap-2 cursor-pointer">
                          <input type="radio" name={`drill-${drill.id}`} checked={state.drills[drill.id] === i} disabled={completed || !derived.complete} onChange={() => update({ drills: { ...state.drills, [drill.id]: i } })} data-testid={`drill-${drill.id}-${i}`} />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                    {!derived.complete && <p className="text-xs muted mt-1">Choose every component first; the right answer depends on them.</p>}
                    {state.drills[drill.id] !== undefined && derived.complete && <p className={`text-xs mt-1 ${check?.passed ? "text-emerald-400" : "text-red-400"}`}>{check?.passed ? `Correct. ${drill.explanation}` : "Not with this design. Re-read the components you chose and their failure modes."}</p>}
                  </fieldset>
                );
              })}
            </div>
          </Panel>

          <Panel title="Justification">
            <p className="text-xs muted mb-1">
              Name your components and the tradeoffs you made. The rubric checks structure only (length, components named, {r.justificationMinTerms} of: {r.justificationTerms.join(", ")}); it cannot judge whether the reasoning is good. Use the reflection prompt and the interview coach for that.
            </p>
            <textarea className="input h-32" disabled={completed} value={state.justification} onChange={(e) => update({ justification: e.target.value })} data-testid="design-justification" />
            <Callout kind="info" title="What the rubric is">
              A transparent set of rules over the numbers you chose. It does not know whether your design is elegant, only whether it meets the stated requirements and whether you explained it in the required shape.
            </Callout>
          </Panel>
        </div>
      }
    />
  );
}
