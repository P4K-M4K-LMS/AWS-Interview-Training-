import { describe, expect, it } from "vitest";
import { applyAction, BASELINE_CONFIG, computeMetrics, createState, failover, generateLogs, step } from "../src/engine/sim/model";
import { actIncident, answerRootCause, createIncident, incidentChecks, inspect, tickIncident, writePostmortem, type IncidentState } from "../src/engine/sim/incident";
import { incidentMissions } from "../src/content/missions/incidents";
import { serverlessIncidents } from "../src/content/missions/serverless";
import type { IncidentMission } from "../src/domain/types";

const byId = (id: string) => [...incidentMissions, ...serverlessIncidents].find((m) => m.id === id)!;

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

  it("replica lag grows while blocked, drains once unblocked, and failover from a lagging standby loses writes", () => {
    let s = createState({ ...BASELINE_CONFIG, replicaBlocked: true }, 0, 10);
    for (let i = 0; i < 10; i++) s = step(s);
    expect(s.replicaLag).toBe(20);
    const m = computeMetrics(s);
    expect(m.staleReads).toBe(true);
    expect(m.health).toBe("degraded");
    expect(computeMetrics({ ...s, config: { ...s.config, readsFromPrimary: true } }).staleReads).toBe(false);
    expect(computeMetrics({ ...s, config: { ...s.config, readsFromPrimary: true } }).dbQps).toBeGreaterThan(m.dbQps);
    s = { ...s, config: applyAction(s.config, { type: "kill-blocking-query" }) };
    for (let i = 0; i < 10; i++) s = step(s);
    expect(s.replicaLag).toBe(0);
    expect(computeMetrics(s).health).toBe("healthy");
    const lost = failover(createState({ ...BASELINE_CONFIG, replicaBlocked: true }, 0, 30));
    expect(lost.lostWritesSec).toBe(30);
    expect(lost.replicaLag).toBe(0);
    expect(failover(createState(BASELINE_CONFIG, 0, 0)).lostWritesSec).toBe(0);
  });

  it("serverless: throttles above rate × duration, warms up after a limit increase, drains poison into a DLQ, duplicates or loses timed-out work", () => {
    const sl = { durationMs: 120, reservedConcurrency: 10, provisionedConcurrency: 0, poisonRate: 0, maxReceiveCount: 3, dlqEnabled: true, timeoutRate: 0, asyncRetries: 2, handlerIdempotent: true };
    let s = createState({ ...BASELINE_CONFIG, requestsPerSec: 300, workers: 8, cacheHitRate: 0.9, queueConsumers: 4, serverless: sl }, 0, 0, { warmEnvironments: 10 });
    let m = computeMetrics(s);
    expect(m.fn?.neededConcurrency).toBeCloseTo(36, 5);
    expect(m.fn?.throttleRate).toBeCloseTo(0.72, 1);
    expect(m.health).toBe("critical");
    s = { ...s, config: applyAction(s.config, { type: "set-reserved-concurrency", concurrency: 40 }) };
    m = computeMetrics(s);
    expect(m.fn?.throttleRate).toBe(0);
    expect(m.fn?.coldStartShare).toBeGreaterThan(0.5);
    expect(m.health).not.toBe("healthy");
    for (let i = 0; i < 14; i++) s = step(s);
    m = computeMetrics(s);
    expect(m.fn?.coldStartShare).toBe(0);
    expect(m.health).toBe("healthy");
    // Provisioned concurrency pre-warms immediately.
    const warm = step(createState({ ...BASELINE_CONFIG, requestsPerSec: 300, workers: 8, cacheHitRate: 0.9, queueConsumers: 4, serverless: { ...sl, reservedConcurrency: 40, provisionedConcurrency: 36 } }));
    expect(computeMetrics(warm).fn?.coldStartShare).toBe(0);
    // Poison messages: without a DLQ they eat consumer capacity; with one they drain within seconds.
    let p = createState({ ...BASELINE_CONFIG, requestsPerSec: 150, serverless: { ...sl, durationMs: 100, reservedConcurrency: 50, poisonRate: 0.02, maxReceiveCount: 10, dlqEnabled: false } }, 500, 0, { warmEnvironments: 15, poisonBacklog: 60 });
    for (let i = 0; i < 10; i++) p = step(p);
    expect(p.queueDepth).toBeGreaterThan(900);
    expect(p.dlqDepth).toBe(0);
    p = { ...p, config: applyAction(p.config, { type: "enable-dlq", maxReceiveCount: 3 }) };
    for (let i = 0; i < 10; i++) p = step(p);
    expect(p.poisonBacklog).toBeLessThan(5);
    expect(p.dlqDepth).toBeGreaterThan(50);
    // Timed-out async invocations duplicate side effects unless idempotent, or are lost with retries off.
    let d = createState({ ...BASELINE_CONFIG, requestsPerSec: 100, serverless: { ...sl, durationMs: 100, reservedConcurrency: 50, timeoutRate: 0.15, handlerIdempotent: false } }, 10, 0, { warmEnvironments: 10 });
    d = step(d);
    expect(d.duplicateSideEffects).toBeCloseTo(4.5, 5);
    expect(computeMetrics(d).health).toBe("degraded");
    const noRetry = step({ ...d, config: applyAction(d.config, { type: "set-async-retries", retries: 0 }) });
    expect(noRetry.duplicateSideEffects).toBeCloseTo(4.5, 5);
    expect(noRetry.lostInvocations).toBeCloseTo(4.5, 5);
    const fixed = step({ ...d, config: applyAction(d.config, { type: "make-handler-idempotent" }) });
    expect(fixed.duplicateSideEffects).toBeCloseTo(4.5, 5);
    expect(computeMetrics(fixed).health).toBe("healthy");
    // Scenarios without a serverless part are untouched.
    expect(computeMetrics(createState(BASELINE_CONFIG)).fn).toBeUndefined();
  });

  it("produces evidence-bearing logs", () => {
    const s = createState({ ...BASELINE_CONFIG, cacheHitRate: 0.3, requestsPerSec: 200 }, 0);
    const lines = Array.from({ length: 8 }, (_, i) => generateLogs({ ...s, tick: i })).flat().join("\n");
    expect(lines).toMatch(/cache-01 WARN hit ratio 30%/);
    expect(lines).toMatch(/db-primary WARN .* exceeds capacity/);
    const r = createState({ ...BASELINE_CONFIG, replicaBlocked: true }, 0, 40);
    const replica = Array.from({ length: 12 }, (_, i) => generateLogs({ ...r, tick: i })).flat().join("\n");
    expect(replica).toMatch(/db-replica WARN replication lag 40s and rising/);
    expect(replica).toMatch(/apply thread waiting for lock on positions; held by pid 8812/);
    expect(replica).toMatch(/db-primary INFO 12 writes\/s committed; replication stream sending normally/);
    expect(replica).toMatch(/GET \/positions served from db-replica \(data age 40s\)/);
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
    for (const m of [...incidentMissions, ...serverlessIncidents]) {
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

  it("replica lag: killing the blocking query recovers; pinning reads alone, scaling workers, or failing over do not", () => {
    const m = byId("incident-04-replica-lag");
    const opened = createIncident(m);
    expect(computeMetrics(opened.sim).errorRate).toBeLessThan(0.03);
    expect(computeMetrics(opened.sim).staleReads).toBe(true);
    const good = solve(m, (s) => actIncident(m, s, { type: "kill-blocking-query" }));
    expect(good.recovered).toBe(true);
    expect(good.sim.tick).toBeLessThan(60);
    expect(incidentChecks(m, good).every((c) => c.passed)).toBe(true);
    // Mitigate first, then fix the cause, then route back once caught up.
    let staged = createIncident(m);
    staged = inspect(inspect(staged, "logs"), "metrics");
    staged = answerRootCause(staged, 2);
    staged = actIncident(m, staged, { type: "route-reads-primary" });
    staged = tickIncident(m, staged);
    expect(computeMetrics(staged.sim).health).toBe("healthy");
    expect(incidentChecks(m, staged).find((c) => c.id === "remediate")?.detail).toMatch(/still blocked/);
    staged = actIncident(m, staged, { type: "kill-blocking-query" });
    for (let i = 0; i < 40 && staged.sim.replicaLag > 5; i++) staged = tickIncident(m, staged);
    staged = tickIncident(m, staged);
    expect(incidentChecks(m, staged).find((c) => c.id === "remediate")?.detail).toMatch(/route map reads back/);
    staged = actIncident(m, staged, { type: "route-reads-replica" });
    staged = writePostmortem(staged, "What: stale map. Why: analytics query blocked the replica apply thread. Fix: killed it, pinned reads meanwhile. Prevention: statement timeout and lag alert.");
    for (let i = 0; i < 20 && !staged.recovered; i++) staged = tickIncident(m, staged);
    expect(staged.recovered).toBe(true);
    expect(incidentChecks(m, staged).every((c) => c.passed)).toBe(true);
    const pinOnly = solve(m, (s) => actIncident(m, s, { type: "route-reads-primary" }), 60);
    expect(pinOnly.recovered).toBe(false);
    expect(pinOnly.sim.replicaLag).toBeGreaterThan(100);
    const workers = solve(m, (s) => actIncident(m, s, { type: "scale-workers", workers: 8 }), 60);
    expect(workers.recovered).toBe(false);
    expect(incidentChecks(m, workers).find((c) => c.id === "remediate")?.detail).toMatch(/never the bottleneck/);
    const failedOver = solve(m, (s) => actIncident(m, s, { type: "restart-db" }), 60);
    expect(failedOver.recovered).toBe(false);
    expect(failedOver.sim.lostWritesSec).toBeGreaterThanOrEqual(45);
    expect(failedOver.logs.join("\n")).toMatch(/data loss/);
    expect(incidentChecks(m, failedOver).find((c) => c.id === "remediate")?.detail).toMatch(/writes are lost/);
  });

  it("throttled function: raising the limit recovers (after warm-up); workers, shedding, or a limit below rate × duration do not", () => {
    const m = byId("serverless-01-throttled-function");
    const good = solve(m, (s) => actIncident(m, s, { type: "set-reserved-concurrency", concurrency: 40 }));
    expect(good.recovered).toBe(true);
    expect(good.sim.tick).toBeGreaterThan(15);
    expect(incidentChecks(m, good).every((c) => c.passed)).toBe(true);
    const warm = solve(m, (s) => actIncident(m, actIncident(m, s, { type: "set-reserved-concurrency", concurrency: 40 }), { type: "set-provisioned-concurrency", concurrency: 36 }));
    expect(warm.recovered).toBe(true);
    expect(warm.sim.tick).toBeLessThan(good.sim.tick);
    const workers = solve(m, (s) => actIncident(m, s, { type: "scale-workers", workers: 16 }), 60);
    expect(workers.recovered).toBe(false);
    expect(incidentChecks(m, workers).find((c) => c.id === "remediate")?.detail).toMatch(/do not change the function's limit/);
    const low = solve(m, (s) => actIncident(m, s, { type: "set-reserved-concurrency", concurrency: 20 }), 60);
    expect(low.recovered).toBe(false);
    const shed = solve(m, (s) => actIncident(m, s, { type: "set-traffic", requestsPerSec: 80 }), 60);
    expect(shed.recovered).toBe(false);
    expect(incidentChecks(m, shed).find((c) => c.id === "remediate")?.detail).toMatch(/legitimate partner traffic/);
  });

  it("poison messages: DLQ with a sane receive count plus consumers recovers; consumers alone or receive count 1 do not", () => {
    const m = byId("serverless-02-poison-messages");
    const good = solve(m, (s) => actIncident(m, actIncident(m, s, { type: "enable-dlq", maxReceiveCount: 3 }), { type: "set-consumers", consumers: 6 }));
    expect(good.recovered).toBe(true);
    expect(good.sim.dlqDepth).toBeGreaterThan(50);
    expect(incidentChecks(m, good).every((c) => c.passed)).toBe(true);
    const consumersOnly = solve(m, (s) => actIncident(m, s, { type: "set-consumers", consumers: 8 }), 60);
    expect(consumersOnly.recovered).toBe(false);
    expect(incidentChecks(m, consumersOnly).find((c) => c.id === "remediate")?.detail).toMatch(/hide the symptom/);
    const one = solve(m, (s) => actIncident(m, actIncident(m, s, { type: "enable-dlq", maxReceiveCount: 1 }), { type: "set-consumers", consumers: 6 }), 60);
    expect(one.recovered).toBe(false);
    expect(incidentChecks(m, one).find((c) => c.id === "remediate")?.detail).toMatch(/transient failure/);
  });

  it("duplicate charges: the idempotent handler recovers; retries off or a longer timeout alone do not", () => {
    const m = byId("serverless-03-duplicate-charges");
    const good = solve(m, (s) => actIncident(m, actIncident(m, s, { type: "make-handler-idempotent" }), { type: "raise-function-timeout" }));
    expect(good.recovered).toBe(true);
    expect(incidentChecks(m, good).every((c) => c.passed)).toBe(true);
    const noRetry = solve(m, (s) => actIncident(m, s, { type: "set-async-retries", retries: 0 }), 60);
    expect(noRetry.recovered).toBe(false);
    expect(noRetry.sim.lostInvocations).toBeGreaterThan(0);
    expect(incidentChecks(m, noRetry).find((c) => c.id === "remediate")?.detail).toMatch(/lost/);
    const timeoutOnly = solve(m, (s) => actIncident(m, s, { type: "raise-function-timeout" }), 60);
    expect(timeoutOnly.recovered).toBe(false);
    expect(incidentChecks(m, timeoutOnly).find((c) => c.id === "remediate")?.detail).toMatch(/still duplicates/);
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
