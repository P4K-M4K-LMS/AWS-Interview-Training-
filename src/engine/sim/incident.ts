import type { CheckResult, IncidentMission } from "../../domain/types";
import { applyAction, computeMetrics, createState, generateLogs, step, type SimAction, type SimMetrics, type SimState } from "./model";

/**
 * Incident state machine. Pure functions so missions can be proven solvable
 * in tests and the UI can persist/restore the state as JSON.
 */
export interface IncidentState {
  sim: SimState;
  actions: Array<{ at: number; action: SimAction }>;
  logs: string[];
  inspected: { logs: boolean; metrics: boolean; diagram: boolean };
  rootCauseAnswer: number | null;
  /** Consecutive healthy ticks since the last action. */
  healthyStreak: number;
  recovered: boolean;
  postmortem: string;
  /** Minute marker for the incident clock (ticks since open). */
  openedAtTick: number;
}

export function createIncident(mission: IncidentMission): IncidentState {
  const sim = createState(mission.scenario.initialConfig, mission.scenario.initialQueueDepth);
  const state: IncidentState = {
    sim,
    actions: [],
    logs: [],
    inspected: { logs: false, metrics: false, diagram: false },
    rootCauseAnswer: null,
    healthyStreak: 0,
    recovered: false,
    postmortem: "",
    openedAtTick: 0,
  };
  // Pre-fill a few seconds of logs so the console opens with evidence.
  let s = state;
  for (let i = 0; i < 6; i++) s = tickIncident(mission, s);
  return s;
}

export function tickIncident(mission: IncidentMission, state: IncidentState): IncidentState {
  const sim = step(state.sim);
  const metrics = computeMetrics(sim);
  const logs = [...state.logs, ...generateLogs(sim, metrics)].slice(-200);
  const remediated = mission.scenario.remediationCheck(sim.config).passed;
  const healthyStreak = metrics.health === "healthy" && remediated ? state.healthyStreak + 1 : 0;
  const recovered = state.recovered || healthyStreak >= mission.scenario.verifyTicks;
  return { ...state, sim, logs, healthyStreak, recovered };
}

export function actIncident(mission: IncidentMission, state: IncidentState, action: SimAction): IncidentState {
  if (!mission.scenario.allowedActions.includes(action.type)) return state;
  const config = applyAction(state.sim.config, action);
  const ts = new Date(Date.UTC(2026, 2, 9, 9, 0, 0) + state.sim.tick * 1000).toISOString().slice(11, 19);
  return {
    ...state,
    sim: { ...state.sim, config },
    actions: [...state.actions, { at: state.sim.tick, action }],
    logs: [...state.logs, `${ts} responder ACTION ${describeAction(action)}`].slice(-200),
    healthyStreak: 0,
  };
}

export function describeAction(a: SimAction): string {
  switch (a.type) {
    case "scale-workers":
      return `scaled API workers to ${a.workers}`;
    case "set-cache-hit":
      return `re-warmed cache with jittered TTLs (target hit ratio ${(a.rate * 100).toFixed(0)}%)`;
    case "restart-db":
      return "failed over to the standby database";
    case "set-consumers":
      return `restarted queue consumers (${a.consumers} running)`;
    case "rollback-deploy":
      return "rolled back the deploy";
    case "set-traffic":
      return `rate-limited traffic to ${a.requestsPerSec} req/s`;
  }
}

export function inspect(state: IncidentState, what: keyof IncidentState["inspected"]): IncidentState {
  return { ...state, inspected: { ...state.inspected, [what]: true } };
}

export function answerRootCause(state: IncidentState, index: number): IncidentState {
  return { ...state, rootCauseAnswer: index };
}

export function writePostmortem(state: IncidentState, text: string): IncidentState {
  return { ...state, postmortem: text };
}

export function incidentChecks(mission: IncidentMission, state: IncidentState, metrics: SimMetrics = computeMetrics(state.sim)): CheckResult[] {
  const sc = mission.scenario;
  const remediation = sc.remediationCheck(state.sim.config);
  return [
    { id: "investigate", label: "Investigated the evidence (logs and metrics)", passed: state.inspected.logs && state.inspected.metrics, detail: state.inspected.logs ? "open the Metrics tab" : "open the Logs tab" },
    { id: "root-cause", label: "Identified the root cause", passed: state.rootCauseAnswer === sc.rootCause.correctIndex, detail: state.rootCauseAnswer === null ? "answer the root-cause question" : "not the cause; check the logs again" },
    { id: "remediate", label: "Applied a remediation that fixes the cause", passed: remediation.passed, detail: remediation.detail },
    { id: "verify", label: `Recovery verified: healthy for ${sc.verifyTicks}s`, passed: state.recovered, detail: remediation.passed ? `healthy for ${state.healthyStreak}s (now ${metrics.health})` : "remediate first" },
    { id: "postmortem", label: "Post-incident note written (what, why, fix, prevention)", passed: state.postmortem.trim().length >= 60, detail: `${state.postmortem.trim().length}/60 characters` },
  ];
}
