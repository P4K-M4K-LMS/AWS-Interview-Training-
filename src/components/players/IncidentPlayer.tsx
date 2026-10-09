import { useEffect, useMemo, useRef, useState } from "react";
import type { IncidentMission, MissionProgress } from "../../domain/types";
import { ACTION_LABELS, computeMetrics, type SimAction } from "../../engine/sim/model";
import { actIncident, answerRootCause, createIncident, incidentChecks, inspect, tickIncident, writePostmortem, type IncidentState } from "../../engine/sim/incident";
import { recordAttempt, saveMissionState } from "../../engine/missions/engine";
import { MetricsGrid, Sparkline } from "../sim/SimDashboard";
import { ArchitectureDiagram } from "../sim/ArchitectureDiagram";
import { MissionFrame } from "./MissionFrame";
import { Callout, Panel } from "../ui";
import { logActivity } from "../../data/db";

interface Props {
  mission: IncidentMission;
  progress: MissionProgress | undefined;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  retention?: boolean;
  onGiveUp?: () => void;
}

type Tab = "ticket" | "metrics" | "logs" | "diagram";

export function IncidentPlayer({ mission, progress, completed, onComplete, onReset, retention, onGiveUp }: Props) {
  const [state, setState] = useState<IncidentState>(() => (progress?.savedState as IncidentState | undefined)?.sim ? (progress!.savedState as IncidentState) : createIncident(mission));
  const [tab, setTab] = useState<Tab>("ticket");
  const [paused, setPaused] = useState(completed);
  const [history, setHistory] = useState<Array<{ p95: number; err: number; depth: number }>>([]);
  const [workers, setWorkers] = useState(mission.scenario.initialConfig.workers);
  const [consumers, setConsumers] = useState(Math.max(2, mission.scenario.initialConfig.queueConsumers));
  const [traffic, setTraffic] = useState(mission.scenario.initialConfig.requestsPerSec);
  const logRef = useRef<HTMLDivElement>(null);
  const metrics = useMemo(() => computeMetrics(state.sim), [state.sim]);
  const checks = useMemo(() => incidentChecks(mission, state, metrics), [mission, state, metrics]);

  // Simulated clock: one tick per second while the incident is open.
  useEffect(() => {
    if (paused || completed) return;
    const id = setInterval(() => setState((s) => tickIncident(mission, s)), 1000);
    return () => clearInterval(id);
  }, [paused, completed, mission]);

  useEffect(() => {
    setHistory((h) => [...h, { p95: metrics.latencyP95, err: metrics.errorRate * 100, depth: metrics.queueDepth }].slice(-60));
  }, [metrics]);

  useEffect(() => {
    if (state.sim.tick % 5 === 0 && !completed) void saveMissionState(mission.id, state);
  }, [state, mission.id, completed]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [state.logs.length, tab]);

  const act = (action: SimAction) => {
    setState((s) => actIncident(mission, s, action));
    void logActivity({ type: "mission-start", missionId: mission.id, detail: `incident action: ${action.type}`, minutes: 1 });
  };
  const advance = (n: number) => setState((s) => {
    let next = s;
    for (let i = 0; i < n; i++) next = tickIncident(mission, next);
    return next;
  });
  const openTab = (t: Tab) => {
    setTab(t);
    if (t === "logs" || t === "metrics" || t === "diagram") setState((s) => inspect(s, t));
  };

  const sc = mission.scenario;
  const elapsed = state.sim.tick;

  return (
    <MissionFrame
      mission={mission}
      progress={progress}
      checks={checks}
      completed={completed}
      onComplete={onComplete}
      onReset={() => {
        setState(createIncident(mission));
        setHistory([]);
        onReset();
      }}
      retention={retention}
      onGiveUp={onGiveUp}
      workstation={
        <div className="space-y-4">
          <Panel
            title="Incident console"
            actions={
              <div className="flex items-center gap-2 text-xs">
                <span className={`badge ${metrics.health === "healthy" ? "text-emerald-400" : metrics.health === "degraded" ? "text-amber-400" : "text-red-400"}`} data-testid="incident-health">
                  {metrics.health}
                </span>
                <span className="muted">T+{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
                <button type="button" className="btn-ghost" onClick={() => setPaused((p) => !p)} disabled={completed}>
                  {paused ? "▶ Resume clock" : "⏸ Pause"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => advance(10)} disabled={completed} data-testid="advance-10">
                  ⏩ Advance 10s
                </button>
              </div>
            }
          >
            <div className="flex gap-1 mb-3 border-b" style={{ borderColor: "var(--border)" }} role="tablist">
              {(["ticket", "metrics", "logs", "diagram"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={`px-3 py-1.5 text-sm -mb-px border-b-2 capitalize ${tab === t ? "border-amber-500 text-amber-500" : "border-transparent muted"}`} onClick={() => openTab(t)} data-testid={`tab-${t}`}>
                  {t}
                </button>
              ))}
            </div>
            {tab === "ticket" && (
              <div className="space-y-2 text-sm">
                <div className="font-semibold">{sc.ticket.title}</div>
                <div className="text-xs muted">Reported by {sc.ticket.reporter}</div>
                <p>{sc.ticket.description}</p>
                <div>
                  <div className="label">Symptoms</div>
                  <ul className="list-disc pl-5">
                    {sc.ticket.symptoms.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="label">Service impact</div>
                  <p>{sc.ticket.impact}</p>
                </div>
                <Callout kind="info" title="Investigation workflow">
                  1. Read Metrics and Logs. 2. Name the root cause. 3. Apply a runbook action that removes the cause. 4. Watch the health check stay green for {sc.verifyTicks}s. 5. Write the post-incident note.
                </Callout>
              </div>
            )}
            {tab === "metrics" && (
              <div className="space-y-3">
                <MetricsGrid m={metrics} deployInProgress={state.sim.config.deployInProgress} />
                <div className="grid md:grid-cols-3 gap-3">
                  <Sparkline data={history.map((h) => h.p95)} max={2000} color="#f59e0b" label="p95 latency (ms)" />
                  <Sparkline data={history.map((h) => h.err)} max={60} color="#ef4444" label="error rate (%)" />
                  <Sparkline data={history.map((h) => h.depth)} max={2000} color="#38bdf8" label="queue depth" />
                </div>
              </div>
            )}
            {tab === "logs" && (
              <div ref={logRef} className="terminal rounded-lg p-3 h-72 overflow-auto whitespace-pre-wrap text-xs" role="log" aria-live="polite" data-testid="incident-logs">
                {state.logs.map((l, i) => (
                  <div key={i} className={/ERROR/.test(l) ? "text-red-300" : /WARN/.test(l) ? "text-amber-200" : /ACTION/.test(l) ? "text-sky-300" : "text-slate-200"}>
                    {l}
                  </div>
                ))}
              </div>
            )}
            {tab === "diagram" && (
              <div className="space-y-2">
                <ArchitectureDiagram state={state.sim} metrics={metrics} />
                <p className="text-xs muted">Node colour follows each component's own health; edge width follows traffic. Failures show where they originate, not only where they are felt.</p>
              </div>
            )}
          </Panel>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Runbook actions">
              <div className="space-y-3 text-sm">
                {sc.allowedActions.includes("scale-workers") && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label htmlFor="workers" className="w-44">
                      {ACTION_LABELS["scale-workers"]}
                    </label>
                    <input id="workers" type="number" className="input w-20" min={1} max={16} value={workers} onChange={(e) => setWorkers(Number(e.target.value) || 1)} />
                    <button type="button" className="btn-secondary" disabled={completed} onClick={() => act({ type: "scale-workers", workers })} data-testid="act-scale-workers">
                      Apply
                    </button>
                  </div>
                )}
                {sc.allowedActions.includes("set-cache-hit") && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-44">{ACTION_LABELS["set-cache-hit"]}</span>
                    <button type="button" className="btn-secondary" disabled={completed} onClick={() => act({ type: "set-cache-hit", rate: 0.85 })} data-testid="act-cache">
                      Re-warm to 85%
                    </button>
                  </div>
                )}
                {sc.allowedActions.includes("set-consumers") && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label htmlFor="consumers" className="w-44">
                      {ACTION_LABELS["set-consumers"]}
                    </label>
                    <input id="consumers" type="number" className="input w-20" min={0} max={12} value={consumers} onChange={(e) => setConsumers(Number(e.target.value) || 0)} />
                    <button type="button" className="btn-secondary" disabled={completed} onClick={() => act({ type: "set-consumers", consumers })} data-testid="act-consumers">
                      Apply
                    </button>
                  </div>
                )}
                {sc.allowedActions.includes("set-traffic") && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label htmlFor="traffic" className="w-44">
                      {ACTION_LABELS["set-traffic"]}
                    </label>
                    <input id="traffic" type="number" className="input w-24" min={10} max={1000} value={traffic} onChange={(e) => setTraffic(Number(e.target.value) || 10)} />
                    <button type="button" className="btn-secondary" disabled={completed} onClick={() => act({ type: "set-traffic", requestsPerSec: traffic })} data-testid="act-traffic">
                      Apply
                    </button>
                  </div>
                )}
                {sc.allowedActions.includes("restart-db") && (
                  <button type="button" className="btn-secondary" disabled={completed} onClick={() => act({ type: "restart-db" })}>
                    {ACTION_LABELS["restart-db"]}
                  </button>
                )}
                {sc.allowedActions.includes("rollback-deploy") && (
                  <button type="button" className="btn-secondary ml-2" disabled={completed} onClick={() => act({ type: "rollback-deploy" })}>
                    {ACTION_LABELS["rollback-deploy"]}
                  </button>
                )}
                {state.actions.length > 0 && (
                  <div className="text-xs muted">
                    Actions taken: {state.actions.length}. Every action resets the recovery timer; the system must stay healthy for {sc.verifyTicks}s after a valid remediation.
                  </div>
                )}
              </div>
            </Panel>
            <Panel title="Root cause and post-incident note">
              <fieldset className="text-sm">
                <legend className="font-medium mb-1">{sc.rootCause.prompt}</legend>
                <div className="space-y-1">
                  {sc.rootCause.options.map((o, i) => (
                    <label key={i} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="root-cause"
                        checked={state.rootCauseAnswer === i}
                        disabled={completed}
                        onChange={() => {
                          setState((s) => answerRootCause(s, i));
                          void recordAttempt(mission.id, i === sc.rootCause.correctIndex ? 0.5 : 0.2);
                        }}
                        data-testid={`root-cause-${i}`}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
                {state.rootCauseAnswer !== null && (
                  <div className={`text-xs mt-1 ${state.rootCauseAnswer === sc.rootCause.correctIndex ? "text-emerald-400" : "text-red-400"}`}>
                    {state.rootCauseAnswer === sc.rootCause.correctIndex ? `Correct. ${sc.rootCause.explanation}` : "Not the cause. Re-read the logs: which component failed first?"}
                  </div>
                )}
              </fieldset>
              <label className="label mt-3" htmlFor="postmortem">
                Post-incident note
              </label>
              <p className="text-xs muted mb-1">{sc.postmortemPrompt}</p>
              <textarea id="postmortem" className="input h-28" value={state.postmortem} disabled={completed} onChange={(e) => setState((s) => writePostmortem(s, e.target.value))} data-testid="postmortem" />
            </Panel>
          </div>
        </div>
      }
    />
  );
}
