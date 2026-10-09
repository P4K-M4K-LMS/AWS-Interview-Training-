import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { DEPLOY_EXERCISES } from "../src/content/study/deployExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { checkRollout, simulateRollout, type Fleet, type Guard, type Release } from "../src/engine/deploy/rollout";
import { creditLabExercise } from "../src/engine/study/bridge";

const fleet: Fleet = { requestsPerSec: 200, restartSeconds: 20, buildSeconds: 60, headroom: 0.4 };
const good: Release = { name: "good", defect: null };
const bad: Release = { name: "bad", defect: { errorRate: 0.3, appearsAfterSeconds: 0, visibleToSyntheticChecks: false } };
const guard: Guard = { alarmErrorRate: 0.01, evaluationSeconds: 10, autoRollback: true };

describe("rollout simulation", () => {
  it("all at once is a full outage for the restart; rolling within headroom fails nothing", () => {
    const all = simulateRollout(fleet, good, { kind: "all-at-once" }, { ...guard, autoRollback: false });
    expect(all.minCapacityShare).toBe(0);
    expect(all.failedRequests).toBe(4000);
    expect(all.completed).toBe(true);
    expect(all.finishedAt).toBe(21);
    const rolling = simulateRollout(fleet, good, { kind: "rolling", batchPercent: 25, bakeSeconds: 10 }, { ...guard, autoRollback: false });
    expect(rolling.minCapacityShare).toBeCloseTo(0.75, 6);
    expect(rolling.failedRequests).toBe(0);
    expect(rolling.completed).toBe(true);
    expect(rolling.finishedAt).toBe(121);
    // Batches larger than the headroom fail the overflow.
    const half = simulateRollout(fleet, good, { kind: "rolling", batchPercent: 50, bakeSeconds: 0 }, { ...guard, autoRollback: false });
    expect(half.failedRequests).toBeGreaterThan(0);
    expect(half.ticks[0].errorRate).toBeCloseTo(1 - 0.5 / 0.6, 6);
  });

  it("a canary limits exposure to its share until the alarm fires, then rolls back", () => {
    const r = simulateRollout(fleet, bad, { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, guard);
    expect(r.rolledBack).toBe(true);
    expect(r.completed).toBe(false);
    expect(r.alarmAt).toBe(29); // canary lands at 20 s, ten breaching seconds, alarm at the 30th second
    expect(r.failedRequests).toBe(30); // 5% × 30% × 200 req/s × 10 s
    expect(r.finishedAt).toBe(50);
    expect(Math.max(...r.ticks.map((t) => t.shareNew))).toBeCloseTo(0.05, 6);
    const wide = simulateRollout(fleet, bad, { kind: "rolling", batchPercent: 25, bakeSeconds: 10 }, guard);
    expect(wide.failedRequests).toBe(150);
    expect(wide.minCapacityShare).toBeCloseTo(0.75, 6);
  });

  it("a guard that never fires lets the defect reach everyone; one without auto rollback only watches", () => {
    const loose = simulateRollout(fleet, bad, { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, { ...guard, alarmErrorRate: 0.5 });
    expect(loose.alarmAt).toBeNull();
    expect(loose.completed).toBe(true);
    expect(loose.failedRequests).toBeGreaterThan(1000);
    const manual = simulateRollout(fleet, bad, { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, { ...guard, autoRollback: false });
    expect(manual.alarmAt).toBe(29);
    expect(manual.rolledBack).toBe(false);
    expect(manual.completed).toBe(true);
  });

  it("a latent defect slips past a short bake and is caught by a long one", () => {
    const latent: Release = { name: "latent", defect: { errorRate: 0.5, appearsAfterSeconds: 60, visibleToSyntheticChecks: false } };
    const short = simulateRollout(fleet, latent, { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 10 }, guard);
    const long = simulateRollout(fleet, latent, { kind: "canary", canaryPercent: 5, bakeSeconds: 90, batchPercent: 10 }, guard);
    expect(short.rolledBack && long.rolledBack).toBe(true);
    // Promoted early, the first batch is mid-restart when the alarm fires, so 15% is pulled back at once.
    expect(short.minCapacityShare).toBeCloseTo(0.85, 6);
    expect(long.minCapacityShare).toBeCloseTo(0.95, 6);
    expect(Math.max(...long.ticks.map((t) => t.shareNew))).toBeCloseTo(0.05, 6);
    expect(long.failedRequests).toBeLessThanOrEqual(short.failedRequests);
  });

  it("a second fleet catches a visible defect in synthetic checks with zero customer exposure, and switches back instantly otherwise", () => {
    const visible: Release = { name: "config", defect: { errorRate: 1, appearsAfterSeconds: 0, visibleToSyntheticChecks: true } };
    const bg = simulateRollout(fleet, visible, { kind: "blue-green", bakeSeconds: 30 }, guard);
    expect(bg.rolledBack).toBe(true);
    expect(bg.failedRequests).toBe(0);
    expect(bg.minCapacityShare).toBe(1);
    expect(bg.extraFleetSeconds).toBeGreaterThan(0);
    const traffic = simulateRollout(fleet, bad, { kind: "blue-green", bakeSeconds: 30 }, guard);
    expect(traffic.rolledBack).toBe(true);
    expect(traffic.alarmAt).not.toBeNull();
    const switchTick = traffic.ticks.findIndex((t) => t.shareNew === 1);
    expect(switchTick).toBeGreaterThan(0);
    expect(traffic.finishedAt - switchTick).toBeLessThanOrEqual(guard.evaluationSeconds + 2);
    const goodBg = simulateRollout(fleet, good, { kind: "blue-green", bakeSeconds: 30 }, guard);
    expect(goodBg.completed).toBe(true);
    expect(goodBg.failedRequests).toBe(0);
  });

  it("checks name the failing term", () => {
    const { checks } = checkRollout(fleet, good, { kind: "all-at-once" }, { ...guard, autoRollback: false }, { minCapacityShare: 0.75, failedRequestsBudget: 1000, finishWithinSeconds: 300, extraFleetSecondsBudget: 0 });
    expect(checks.find((c) => c.id === "capacity")?.detail).toMatch(/lowest point 0%/);
    expect(checks.find((c) => c.id === "failed")?.passed).toBe(false);
    expect(checks.find((c) => c.id === "outcome")?.passed).toBe(true);
  });
});

describe("deployment lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and passes with its reference strategy and guard", () => {
    for (const e of DEPLOY_EXERCISES) {
      const start = checkRollout(e.fleet, e.release, e.start.strategy, e.start.guard, e.requirement);
      expect(start.checks.every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const sol = checkRollout(e.fleet, e.release, e.solution.strategy, e.solution.guard, e.requirement);
      expect(sol.checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`), e.id).toEqual([]);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of DEPLOY_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("deploy-02-canary", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["deploy-02-canary"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["deploy-02-canary"].length);
  });

  it("exercise text stays vendor-neutral", () => {
    const text = JSON.stringify(DEPLOY_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "CodeDeploy", "Lambda", "CloudFormation"]) expect(text, word).not.toContain(word);
  });
});
