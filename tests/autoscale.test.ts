import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { AUTOSCALE_EXERCISES, AUTOSCALE_EXERCISE_BY_ID } from "../src/content/study/autoscaleExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { checkScaling, demandAt, simulate, type Config } from "../src/engine/autoscale/simulate";
import { creditLabExercise } from "../src/engine/study/bridge";

const ex = (id: string) => AUTOSCALE_EXERCISE_BY_ID.get(id)!;
const failing = (id: string, config: Config) =>
  checkScaling(ex(id).scenario, config, ex(id).requirement)
    .checks.filter((c) => !c.passed)
    .map((c) => c.id);
const target = (over: Partial<Extract<Config["policy"], { kind: "target" }>> = {}): Config["policy"] => ({ kind: "target", metric: "cpu", target: 0.7, countWarming: true, scaleInCooldownSeconds: 300, ...over });

describe("autoscaling simulation", () => {
  it("interpolates demand between points and holds the ends", () => {
    const pts = [{ at: 100, rps: 10 }, { at: 200, rps: 30 }];
    expect(demandAt(pts, 0)).toBe(10);
    expect(demandAt(pts, 150)).toBe(20);
    expect(demandAt(pts, 500)).toBe(30);
  });

  it("a fixed fleet fails everything above its capacity; target tracking follows the ramp without failures", () => {
    const e = ex("as-01-elastic");
    const fixed = simulate(e.scenario, e.start);
    expect(fixed.failedRequests).toBeGreaterThan(60000);
    expect(fixed.scaleActions).toBe(0);
    const twelve = simulate(e.scenario, { ...e.start, min: 12, max: 12 });
    expect(twelve.failedRequests).toBe(0);
    expect(twelve.instanceSeconds).toBe(14400);
    const tracked = simulate(e.scenario, e.solution);
    expect(tracked.failedRequests).toBe(0);
    expect(tracked.instanceSeconds).toBeLessThan(13000);
    expect(tracked.peakInstances).toBeGreaterThanOrEqual(15);
    // At 70% the small fleet is briefly slow while it waits for the next instance.
    expect(failing("as-01-elastic", { ...e.solution, policy: target({ target: 0.7 }) })).toEqual(["slow"]);
  });

  it("a policy that ignores warming instances launches for the same shortfall at every evaluation and overshoots to the maximum", () => {
    const e = ex("as-02-warmup");
    const runaway = simulate(e.scenario, e.start);
    expect(runaway.peakInstances).toBe(40);
    expect(runaway.scaleActions).toBeGreaterThan(8);
    const counted = simulate(e.scenario, e.solution);
    expect(counted.peakInstances).toBe(22);
    expect(counted.scaleActions).toBeLessThanOrEqual(8);
    expect(counted.instanceSeconds).toBeLessThan(runaway.instanceSeconds);
  });

  it("a scheduled minimum has the capacity warm before a known surge", () => {
    const e = ex("as-03-flash-sale");
    const reactive = simulate(e.scenario, e.start);
    expect(reactive.failedRequests).toBeGreaterThan(30000);
    const scheduled = simulate(e.scenario, e.solution);
    expect(scheduled.failedRequests).toBe(0);
    expect(scheduled.ticks[300].serving).toBe(29);
    expect(scheduled.ticks[899].serving).toBeLessThan(29);
  });

  it("short evaluation periods without a cooldown thrash on every swing; a scale-in cooldown settles the fleet", () => {
    const e = ex("as-04-thrash");
    const thrash = simulate(e.scenario, e.start);
    expect(thrash.scaleActions).toBeGreaterThan(50);
    const steady = simulate(e.scenario, e.solution);
    expect(steady.scaleActions).toBeLessThanOrEqual(10);
    expect(steady.failedRequests).toBe(0);
    expect(failing("as-04-thrash", { ...e.start, min: 12, max: 12, policy: { kind: "none" } })).toEqual(["cost"]);
    expect(failing("as-04-thrash", { ...e.solution, policy: target({ scaleInCooldownSeconds: 300 }) })).toContain("actions");
  });

  it("health checks: interval × threshold is how long a hung instance keeps traffic; a threshold of one throws away a flaky healthy instance", () => {
    const e = ex("as-05-health");
    const slow = simulate(e.scenario, e.start);
    expect(slow.hungDetectedAfter).toBe(120);
    expect(slow.failedRequests).toBe(3600); // 2 of 10 instances × 150 req/s × 120 s
    const fast = simulate(e.scenario, e.solution);
    expect(fast.hungDetectedAfter).toBe(10);
    expect(fast.failedRequests).toBe(300);
    expect(fast.healthyRemoved).toBe(0);
    const trigger = simulate(e.scenario, { ...e.start, healthCheck: { intervalSeconds: 10, unhealthyThreshold: 1 } });
    expect(trigger.healthyRemoved).toBeGreaterThan(0);
    expect(failing("as-05-health", { ...e.start, healthCheck: { intervalSeconds: 30, unhealthyThreshold: 2 } })).toEqual(["failed"]);
  });

  it("an I/O-bound service never reaches a CPU target; requests per instance scales it", () => {
    const e = ex("as-06-metric");
    const cpu = simulate(e.scenario, e.start);
    expect(cpu.scaleActions).toBe(0);
    expect(cpu.failedRequests).toBeGreaterThan(100000);
    const reqs = simulate(e.scenario, e.solution);
    expect(reqs.failedRequests).toBe(0);
    expect(reqs.peakInstances).toBe(25);
  });
});

describe("autoscaling lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and passes with its reference configuration", () => {
    for (const e of AUTOSCALE_EXERCISES) {
      const start = checkScaling(e.scenario, e.start, e.requirement);
      expect(start.checks.every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const sol = checkScaling(e.scenario, e.solution, e.requirement);
      expect(sol.checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`), e.id).toEqual([]);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of AUTOSCALE_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("as-06-metric", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["as-06-metric"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["as-06-metric"].length);
  });

  it("exercise text stays vendor-neutral", () => {
    const text = JSON.stringify(AUTOSCALE_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "EC2", "ELB", "CloudWatch", "Auto Scaling group"]) expect(text, word).not.toContain(word);
  });
});
