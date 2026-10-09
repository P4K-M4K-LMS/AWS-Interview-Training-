import { describe, expect, it } from "vitest";
import { applyAction, BASELINE_CONFIG, computeMetrics, createState, generateLogs, step } from "../src/engine/sim/model";
import { actIncident, answerRootCause, createIncident, incidentChecks, inspect, tickIncident, writePostmortem, type IncidentState } from "../src/engine/sim/incident";
import { incidentMissions } from "../src/content/missions/incidents";
import type { IncidentMission } from "../src/domain/types";

const byId = (id: string) => incidentMissions.find((m) => m.id === id)!;

describe("simulation model", () => {
  it("is healthy at baseline and reacts coherently to each lever", () => {
    const base = computeMetrics(createState(BASELINE_CONFIG));
    expect(base.health).toBe("healthy");
    expect(computeMetrics(createState({ ...BASELINE_CONFIG, requestsPerSec: 500 })).health).toBe("critical");
    expect(computeMetrics(createState({ ...BASELINE_CONFIG, requestsPerSec: 500, workers: 9 })).health).toBe("healthy");
    expect(computeMetrics(createState({ ...BASELINE_CONFIG, cacheHitRate: 0.3, requestsPerSec: 200 })).health).not.toBe("healthy");
    expect(computeMetrics(createState({ ...BASELINE_CONFIG, dbDegraded: true })).errorRate).toBeGreaterThan(0.03);
  });

  it("accumulates the queue when consumers are missing and drains it when restored", () => {
    let s = createState({ ...BASELINE_CONFIG, queueConsumers: 0 }, 0);
    for (let i = 0; i < 10; i++) s = step(s);
    expect(s.queueDepth).toBeCloseTo(360, 0);
    s = { ...s, config: applyAction(s.config, { type: "set-consumers", consumers: 4 }) };
    for (let i = 0; i < 10; i++) s = step(s);
    expect(s.queueDepth).toBeLessThan(10);
  });

  it("produces evidence-bearing logs", () => {
    const s = createState({ ...BASELINE_CONFIG, cacheHitRate: 0.3, requestsPerSec: 200 }, 0);
    const lines = Array.from({ length: 8 }, (_, i) => generateLogs({ ...s, tick: i })).flat().join("\n");
    expect(lines).toMatch(/cache-01 WARN hit ratio 30%/);
    expect(lines).toMatch(/db-primary WARN .* exceeds capacity/);
  });
});

function solve(mission: IncidentMission, remediate: (s: IncidentState) => IncidentState, maxTicks = 200): IncidentState {
  let s = createIncident(mission);
  s = inspect(inspect(s, "logs"), "metrics");
  s = answerRootCause(s, mission.scenario.rootCause.correctIndex);
  s = remediate(s);
  s = writePostmortem(s, "What: incident on the platform. Why: the root cause described in the logs. Fix: applied the runbook remediation. Prevention: add the alert and the safeguard.");
  for (let i = 0; i < maxTicks && !s.recovered; i++) s = tickIncident(mission, s);
  return s;
}

describe("incident missions are solvable and reject symptom-only fixes", () => {
  it("opens with evidence and unmet checks", () => {
    for (const m of incidentMissions) {
      const s = createIncident(m);
      expect(s.logs.length).toBeGreaterThan(2);
      expect(computeMetrics(s.sim).health).not.toBe("healthy");
      expect(incidentChecks(m, s).every((c) => !c.passed)).toBe(true);
    }
  });

  it("cache stampede: re-warming the cache recovers; scaling workers or shedding traffic does not", () => {
    const m = byId("incident-01-cache-stampede");
    const good = solve(m, (s) => actIncident(m, s, { type: "set-cache-hit", rate: 0.85 }));
    expect(good.recovered).toBe(true);
    expect(incidentChecks(m, good).every((c) => c.passed)).toBe(true);
    const workers = solve(m, (s) => actIncident(m, s, { type: "scale-workers", workers: 12 }), 60);
    expect(workers.recovered).toBe(false);
    expect(incidentChecks(m, workers).find((c) => c.id === "remediate")?.detail).toMatch(/saturated database/);
    const shed = solve(m, (s) => actIncident(m, s, { type: "set-traffic", requestsPerSec: 80 }), 60);
    expect(shed.recovered).toBe(false);
  });

  it("traffic surge: 9 workers + 8 consumers recovers; workers alone, too few workers, or rate limiting do not", () => {
    const m = byId("incident-02-traffic-surge");
    const good = solve(m, (s) => actIncident(m, actIncident(m, s, { type: "scale-workers", workers: 9 }), { type: "set-consumers", consumers: 8 }));
    expect(good.recovered).toBe(true);
    expect(incidentChecks(m, good).every((c) => c.passed)).toBe(true);
    const workersOnly = solve(m, (s) => actIncident(m, s, { type: "scale-workers", workers: 12 }), 60);
    expect(workersOnly.recovered).toBe(false);
    expect(incidentChecks(m, workersOnly).find((c) => c.id === "remediate")?.detail).toMatch(/consumers/);
    const tooFew = solve(m, (s) => actIncident(m, actIncident(m, s, { type: "scale-workers", workers: 8 }), { type: "set-consumers", consumers: 8 }), 60);
    expect(tooFew.recovered).toBe(false);
    const shed = solve(m, (s) => actIncident(m, s, { type: "set-traffic", requestsPerSec: 200 }), 60);
    expect(shed.recovered).toBe(false);
    expect(incidentChecks(m, shed).find((c) => c.id === "remediate")?.detail).toMatch(/legitimate customer/);
  });

  it("dead consumers: restarting consumers drains the backlog; a single consumer cannot", () => {
    const m = byId("incident-03-dead-consumers");
    const good = solve(m, (s) => actIncident(m, s, { type: "set-consumers", consumers: 4 }));
    expect(good.recovered).toBe(true);
    expect(good.sim.tick).toBeLessThan(60);
    const one = solve(m, (s) => actIncident(m, s, { type: "set-consumers", consumers: 1 }), 120);
    expect(one.recovered).toBe(false);
  });

  it("ignores actions outside the runbook and resets the recovery timer on every action", () => {
    const m = byId("incident-03-dead-consumers");
    let s = createIncident(m);
    const before = s;
    s = actIncident(m, s, { type: "set-cache-hit", rate: 0.9 });
    expect(s).toBe(before);
    s = actIncident(m, s, { type: "set-consumers", consumers: 6 });
    for (let i = 0; i < 40; i++) s = tickIncident(m, s);
    expect(s.healthyStreak).toBeGreaterThan(0);
    s = actIncident(m, s, { type: "scale-workers", workers: 5 });
    expect(s.healthyStreak).toBe(0);
  });
});
