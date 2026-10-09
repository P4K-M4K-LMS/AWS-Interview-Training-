import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { COST_EXERCISES } from "../src/content/study/costExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { PRICES, checkCost, cheapestFeasible, deriveCost, feasible, type CostPlan, type CostWorkload } from "../src/engine/cost/model";
import { creditLabExercise } from "../src/engine/study/bridge";

const w: CostWorkload = { name: "t", baselineUnits: 10, peakUnits: 30, peakHoursPerDay: 6, batchUnitHours: 1000, batchInterruptible: true, hotGb: 100, coldGb: 1000, coldRetrievedGb: 10, coldRetrievalNeed: "minutes", egressGb: 1000, cacheableShare: 0.5, serviceGb: 1000, zones: 3 };
const plan = (over: Partial<CostPlan>): CostPlan => ({ commitUnits: 0, sizeFactor: 1, batchModel: "on-demand", coldTier: "hot", privateEndpoint: false, natPerZone: false, cdn: false, budgetAlarm: true, tagsFull: true, ...over });

describe("cost model arithmetic", () => {
  it("splits compute into committed and on-demand by hours, and reports idle commitment", () => {
    const none = deriveCost(w, plan({}));
    const compute = none.lines[0].credits + none.lines[1].credits;
    // 10 units for 18 h plus 30 units for 6 h, all on demand: 15 unit-months × 100.
    expect(compute).toBe(1500);
    const floor = deriveCost(w, plan({ commitUnits: 10 }));
    expect(floor.lines[0].credits).toBe(600);
    expect(floor.lines[1].credits).toBe(500);
    expect(floor.idleCommitted).toBe(0);
    const ceiling = deriveCost(w, plan({ commitUnits: 30 }));
    expect(ceiling.lines[0].credits).toBe(1800);
    expect(ceiling.lines[1].credits).toBe(0);
    expect(ceiling.idleCommitted).toBe(15);
    expect(ceiling.utilisation).toBe(0.5);
    const big = deriveCost(w, plan({ sizeFactor: 2 }));
    expect(big.lines[1].credits).toBe(3000);
  });

  it("prices batch, storage tiers with retrieval, egress with and without a cache, and the two transfer paths", () => {
    const d = deriveCost(w, plan({}));
    const line = (name: string) => d.lines.find((l) => l.item.startsWith(name))!.credits;
    expect(line("Batch")).toBeCloseTo(1000 * PRICES.onDemandUnitHour, 1);
    expect(deriveCost(w, plan({ batchModel: "interruptible" })).lines.find((l) => l.item.startsWith("Batch"))!.credits).toBe(40);
    expect(line("Hot storage")).toBe(25);
    expect(line("Cold storage")).toBe(250);
    expect(deriveCost(w, plan({ coldTier: "cool" })).lines.find((l) => l.item.startsWith("Cold"))!.credits).toBe(121);
    expect(deriveCost(w, plan({ coldTier: "archive" })).lines.find((l) => l.item.startsWith("Cold"))!.credits).toBe(43);
    expect(line("Internet egress")).toBe(90);
    const cached = deriveCost(w, plan({ cdn: true }));
    expect(cached.lines.find((l) => l.item.startsWith("Internet egress"))!.credits).toBe(45);
    expect(cached.lines.find((l) => l.item === "Edge cache")!.credits).toBe(45);
    // Translator: 2000 GB (egress + service) × 0.045 + 32 + cross-zone 2/3 × 2000 × 0.01.
    expect(line("Address translator")).toBeCloseTo(32 + 90 + 13.33, 1);
    const ep = deriveCost(w, plan({ privateEndpoint: true }));
    expect(ep.lines.find((l) => l.item === "Private endpoint")!.credits).toBe(31);
    expect(ep.lines.find((l) => l.item.startsWith("Address translator"))!.credits).toBeCloseTo(32 + 45 + 6.67, 1);
    const perZone = deriveCost(w, plan({ natPerZone: true }));
    expect(perZone.lines.find((l) => l.item.startsWith("Address translator"))!.credits).toBe(96 + 90);
  });

  it("knows what is infeasible: undersized compute, interrupting a job that cannot be, archive against a minutes need, missing alarm or tags", () => {
    expect(feasible(w, plan({ sizeFactor: 0.5 }), { targetCredits: 1 })).toBe(false);
    expect(feasible({ ...w, batchInterruptible: false }, plan({ batchModel: "interruptible" }), { targetCredits: 1 })).toBe(false);
    expect(feasible(w, plan({ coldTier: "archive" }), { targetCredits: 1 })).toBe(false);
    expect(feasible({ ...w, coldRetrievalNeed: "hours" }, plan({ coldTier: "archive" }), { targetCredits: 1 })).toBe(true);
    expect(feasible(w, plan({ budgetAlarm: false }), { targetCredits: 1, requireBudgetAlarm: true })).toBe(false);
    expect(feasible(w, plan({ tagsFull: false }), { targetCredits: 1, requireTags: true })).toBe(false);
  });

  it("finds the cheapest feasible plan and the lean check flags over-spending against it", () => {
    const best = cheapestFeasible(w, { targetCredits: 10_000 })!;
    expect(best.plan).toMatchObject({ commitUnits: 10, sizeFactor: 1, batchModel: "interruptible", coldTier: "cool", privateEndpoint: true, cdn: true });
    const over = checkCost(w, { targetCredits: 10_000 }, plan({ commitUnits: 30, sizeFactor: 2 }));
    expect(over.checks.find((c) => c.id === "lean")?.passed).toBe(false);
    expect(over.checks.find((c) => c.id === "target")?.passed).toBe(true);
    expect(over.checks.find((c) => c.id === "capacity")?.detail).toMatch(/utilisation about/);
  });
});

describe("cost lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and its reference solution is the cheapest feasible plan", () => {
    for (const e of COST_EXERCISES) {
      const start = checkCost(e.workload, e.requirement, e.start);
      expect(start.checks.every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const solved = checkCost(e.workload, e.requirement, e.solution);
      expect(solved.checks.filter((c) => !c.passed).map((c) => c.id), e.id).toEqual([]);
      expect(solved.derived.total, `${e.id} solution is the cheapest`).toBe(solved.cheapest?.derived.total);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of COST_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("cost-02-commit-baseline", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["cost-02-commit-baseline"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["cost-02-commit-baseline"].length);
  });

  it("exercise text stays vendor-neutral and prices stay fictional", () => {
    const text = JSON.stringify(COST_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "Reserved Instance", "Savings Plan", "Spot", "S3", "Glacier", "$", "USD"]) expect(text, word).not.toContain(word);
  });
});
