import type { CostPlan, CostRequirement, CostWorkload } from "../../engine/cost/model";

/**
 * Cost model exercises. Each gives a workload, a target spend and a plan
 * that is wrong in an instructive way; the learner changes the plan until
 * every check passes, including "no more than needed". `solution` is the
 * reference the tests use; never shown.
 */
export interface CostExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  workload: CostWorkload;
  requirement: CostRequirement;
  start: CostPlan;
  hints: string[];
  solution: CostPlan;
}

const base: CostWorkload = { name: "Fleet API", baselineUnits: 10, peakUnits: 10, peakHoursPerDay: 0, batchUnitHours: 0, batchInterruptible: false, hotGb: 500, coldGb: 0, coldRetrievedGb: 0, coldRetrievalNeed: "hours", egressGb: 500, cacheableShare: 0, serviceGb: 200, zones: 3 };
const plan = (over: Partial<CostPlan>): CostPlan => ({ commitUnits: 0, sizeFactor: 1, batchModel: "on-demand", coldTier: "hot", privateEndpoint: false, natPerZone: false, cdn: false, budgetAlarm: true, tagsFull: true, ...over });

export const COST_EXERCISES: CostExercise[] = [
  {
    id: "cost-01-rightsize",
    title: "Half the machine is idle",
    brief: "The API runs on instances twice the size its traffic needs; utilisation sits around 35%. Nothing else is wrong. Bring the bill down without touching capacity headroom you actually need.",
    teaches: "Right-sizing: pay for the capacity the demand uses. Oversized instances cost the same whether busy or idle, and the saving repeats every month.",
    workload: { ...base, baselineUnits: 7, peakUnits: 10, peakHoursPerDay: 8 },
    requirement: { targetCredits: 1000 },
    start: plan({ sizeFactor: 2, commitUnits: 8 }),
    hints: ["Open the compute lines: twice the needed size doubles both the on-demand and the committed units you need.", "Set the size factor to 1 and leave the commitment on the quiet-hours baseline.", "A 1× size with 7 committed units covers the quiet hours; the peak runs on demand."],
    solution: plan({ sizeFactor: 1, commitUnits: 7 }),
  },
  {
    id: "cost-02-commit-baseline",
    title: "Commit to the floor, not the ceiling",
    brief: "Demand is 10 units all night and 30 units for 6 daytime hours. Everything is on demand. Commit the right amount: enough to cover what runs all the time, not the peak that runs a quarter of the day.",
    teaches: "Committed capacity is cheaper per unit but is paid while idle. The commitment should cover the steady floor; bursts above it belong on demand.",
    workload: { ...base, baselineUnits: 10, peakUnits: 30, peakHoursPerDay: 6 },
    requirement: { targetCredits: 1700 },
    start: plan({ commitUnits: 0 }),
    hints: ["With no commitment every unit-month costs 100; with a commitment the floor costs 60.", "Try committing 30: the 'committed' line shows 20 units idle for 18 hours a day.", "Commit 10 units: the floor at 60 each, the daytime burst of 20 units on demand for a quarter of the month."],
    solution: plan({ commitUnits: 10 }),
  },
  {
    id: "cost-03-interruptible",
    title: "The nightly report can be interrupted",
    brief: "A nightly aggregation runs 3,000 unit-hours a month on demand. It checkpoints every few minutes and restarts without harm. Move it to the capacity model that fits.",
    teaches: "Interruptible capacity is a fraction of the price for work that can stop and resume. The check is the work's tolerance, not its importance.",
    workload: { ...base, batchUnitHours: 3000, batchInterruptible: true },
    requirement: { targetCredits: 1300 },
    start: plan({ commitUnits: 10 }),
    hints: ["Open the batch line: 3,000 unit-hours at the on-demand hourly rate.", "The job tolerates interruption, so the interruptible model passes the batch check.", "Interruptible batch; keep the API's 10 committed units."],
    solution: plan({ commitUnits: 10, batchModel: "interruptible" }),
  },
  {
    id: "cost-04-tiering",
    title: "Twenty terabytes nobody reads, except when they do",
    brief: "20,000 GB of old telemetry sit in hot storage; about 50 GB a month are read back, and when someone asks for them they need them within minutes. Pick the storage tier.",
    teaches: "Colder tiers trade a lower price per GB for retrieval fees and retrieval time. The cheapest tier that still meets the retrieval need wins; the archive tier's hours-long restore fails this one.",
    workload: { ...base, coldGb: 20000, coldRetrievedGb: 50, coldRetrievalNeed: "minutes" },
    requirement: { targetCredits: 3800 },
    start: plan({ commitUnits: 10, coldTier: "hot" }),
    hints: ["Open the cold storage line: 20,000 GB at the hot price.", "Archive is cheapest per GB but returns data in hours; the requirement says minutes.", "The cool tier: cheaper storage, a small retrieval fee, minutes to retrieve."],
    solution: plan({ commitUnits: 10, coldTier: "cool" }),
  },
  {
    id: "cost-05-transfer-path",
    title: "Service traffic through the translator",
    brief: "The hosts push 8,000 GB a month to the platform's object store through the shared address translator, which charges per GB processed and adds cross-zone hops. Route that traffic the cheaper way.",
    teaches: "Data transfer cost depends on the path. A private endpoint has a fixed fee per zone and a low per-GB price; the translator charges per GB and, when shared, adds cross-zone hops. The arithmetic decides, and here it is not close.",
    workload: { ...base, serviceGb: 8000 },
    requirement: { targetCredits: 1150 },
    start: plan({ commitUnits: 10 }),
    hints: ["Open the translator line: 8,000 GB × 0.045 plus cross-zone hops for two of three zones.", "A private endpoint costs 7 credits per zone plus 0.01 per GB.", "Private endpoint on; one shared translator is still fine for the remaining egress."],
    solution: plan({ commitUnits: 10, privateEndpoint: true }),
  },
  {
    id: "cost-06-cache-and-alarm",
    title: "Egress you could have cached, and a bill nobody watches",
    brief: "The map tiles leave the origin at 20,000 GB a month and 80% of them are identical requests a cache could serve. There is no spend alarm and half the resources carry no tags. Fix all three.",
    teaches: "A cache in front of egress moves the biggest line item; a spend alarm and allocation tags are free and are what lets anyone notice and own the bill.",
    workload: { ...base, egressGb: 20000, cacheableShare: 0.8 },
    requirement: { targetCredits: 2200, requireBudgetAlarm: true, requireTags: true },
    start: plan({ commitUnits: 10, budgetAlarm: false, tagsFull: false }),
    hints: ["Open the egress line: 20,000 GB × 0.09 from the origin.", "The edge cache serves the cacheable 80% at 0.05 per GB plus a small fixed fee.", "Cache on, spend alarm on, tags complete."],
    solution: plan({ commitUnits: 10, cdn: true }),
  },
];

export const COST_EXERCISE_BY_ID = new Map(COST_EXERCISES.map((e) => [e.id, e]));
