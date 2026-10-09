import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { DR_EXERCISES } from "../src/content/study/drExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { ALL_PLANS, checkPlan, cheapestFeasible, evaluatePlan, fmt, meets, type DrPlan } from "../src/engine/dr/plan";
import { creditLabExercise } from "../src/engine/study/bridge";

const api = { name: "Order API", dataGb: 300, computeCredits: 800 };
const plan = (over: Partial<DrPlan>): DrPlan => ({ backup: "hourly-snapshot", standby: "warm", trigger: "automatic", restoreTested: true, ...over });

describe("recovery planner arithmetic", () => {
  it("recovery point is the backup interval and recovery time is the sum of the four steps", () => {
    const d = evaluatePlan(api, plan({}));
    expect(d.rpoMinutes).toBe(60);
    expect(d.timeline.map((s) => s.minutes)).toEqual([3, 15, 15, 1]);
    expect(d.rtoMinutes).toBe(34);
    expect(d.dominant).toBe("provision");
    expect(d.costCredits).toBe(25 + 15 + 280 + 15 + 10);
    const daily = evaluatePlan(api, plan({ backup: "daily-snapshot", standby: "none", trigger: "manual" }));
    expect(daily.rpoMinutes).toBe(1440);
    expect(daily.timeline.map((s) => s.minutes)).toEqual([30, 240, 15, 5]);
    expect(daily.dominant).toBe("provision");
  });

  it("continuous replication removes the restore step; big data makes restore dominate otherwise", () => {
    const big = { name: "Archive", dataGb: 6000, computeCredits: 600 };
    const snap = evaluatePlan(big, plan({}));
    expect(snap.timeline.find((s) => s.id === "restore")?.minutes).toBe(300);
    expect(snap.dominant).toBe("restore");
    const repl = evaluatePlan(big, plan({ backup: "continuous-replication" }));
    expect(repl.timeline.find((s) => s.id === "restore")?.minutes).toBe(0);
    expect(repl.rpoMinutes).toBe(1);
    expect(repl.rtoMinutes).toBe(19);
  });

  it("finds the cheapest plan that meets a requirement, or none", () => {
    const best = cheapestFeasible(api, { rtoMinutes: 60, rpoMinutes: 60, budgetCredits: 500 });
    expect(best?.plan).toEqual(plan({}));
    expect(best?.derived.costCredits).toBe(345);
    expect(cheapestFeasible(api, { rtoMinutes: 1, rpoMinutes: 1, budgetCredits: 10 })).toBeUndefined();
    expect(ALL_PLANS).toHaveLength(24);
    for (const p of ALL_PLANS) expect(p.restoreTested).toBe(true);
    expect(meets(evaluatePlan(api, plan({})), { rtoMinutes: 30, rpoMinutes: 60, budgetCredits: 500 })).toBe(false);
  });

  it("checks name the failing term and flag over-spending against the cheapest feasible plan", () => {
    const over = checkPlan(api, { rtoMinutes: 60, rpoMinutes: 60, budgetCredits: 5000 }, plan({ backup: "continuous-replication", standby: "hot" }));
    const lean = over.checks.find((c) => c.id === "lean");
    expect(lean?.passed).toBe(false);
    expect(lean?.detail).toMatch(/345 credits/);
    const untested = checkPlan(api, { rtoMinutes: 60, rpoMinutes: 60, budgetCredits: 500 }, plan({ restoreTested: false }));
    expect(untested.checks.find((c) => c.id === "tested")?.passed).toBe(false);
    expect(untested.checks.filter((c) => c.id !== "tested").every((c) => c.passed)).toBe(true);
    const slow = checkPlan(api, { rtoMinutes: 30, rpoMinutes: 60, budgetCredits: 500 }, plan({}));
    expect(slow.checks.find((c) => c.id === "rto")?.detail).toMatch(/34 min/);
    expect(fmt(90)).toBe("1 h 30 min");
    expect(fmt(1440)).toBe("24 h");
  });
});

describe("recovery planner exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and its reference solution is the cheapest feasible plan", () => {
    for (const e of DR_EXERCISES) {
      const start = checkPlan(e.workload, e.requirement, e.start);
      expect(start.checks.every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const solved = checkPlan(e.workload, e.requirement, e.solution);
      expect(solved.checks.map((c) => `${c.id}:${c.passed}`), e.id).toEqual(["rpo:true", "rto:true", "budget:true", "tested:true", "lean:true"]);
      expect(solved.cheapest?.plan, `${e.id} solution is the cheapest`).toEqual(e.solution);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of DR_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("dr-01-match-the-need", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["dr-01-match-the-need"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["dr-01-match-the-need"].length);
  });

  it("exercise text stays vendor-neutral and prices stay fictional", () => {
    const text = JSON.stringify(DR_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "Region", "Availability Zone", "$", "USD"]) expect(text, word).not.toContain(word);
  });
});
