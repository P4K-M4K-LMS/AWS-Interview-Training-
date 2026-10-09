import type { DrPlan, DrRequirement, Workload } from "../../engine/dr/plan";

/**
 * Disaster-recovery planner exercises. Each gives a workload, a requirement
 * (recovery time, recovery point, budget) and a starting plan that is wrong
 * in an instructive way; the learner adjusts the plan until every check
 * passes and names the step that dominates the recovery time. `solution`
 * is the reference the tests use; it is never shown.
 */
export interface DrExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  workload: Workload;
  requirement: DrRequirement;
  start: DrPlan;
  hints: string[];
  solution: DrPlan;
}

export const DR_EXERCISES: DrExercise[] = [
  {
    id: "dr-01-match-the-need",
    title: "A nightly warehouse does not need a hot standby",
    brief: "The analytics warehouse is rebuilt from the source systems every night and read by a handful of analysts. Someone gave it a full hot standby with continuous replication. The business tolerates a day without it. Bring the plan down to what the requirement needs, with a tested restore.",
    teaches: "Let the recovery time and recovery point choose the strategy, not the other way round. Spending more than the requirement needs is a failure of the design, not a safety margin.",
    workload: { name: "Analytics warehouse", dataGb: 2000, computeCredits: 1000 },
    requirement: { rtoMinutes: 1440, rpoMinutes: 1440, budgetCredits: 200 },
    start: { backup: "continuous-replication", standby: "hot", trigger: "automatic", restoreTested: false },
    hints: ["Read the checks: the plan is over budget, and the 'no more than needed' line names the cheapest plan that fits.", "A daily snapshot gives a one-day recovery point, which is exactly what is asked.", "No standby means a four-hour rebuild plus a restore, which is still well inside a day."],
    solution: { backup: "daily-snapshot", standby: "none", trigger: "manual", restoreTested: true },
  },
  {
    id: "dr-02-order-api",
    title: "An hour to be back, an hour of orders at most",
    brief: "The order API must be back within an hour and may lose at most an hour of orders, for at most 500 credits a month. The current plan is the cheap one from the warehouse. Find the cheapest plan that meets the requirement.",
    teaches: "The recovery time is a sum: detection, bringing up the standby, restoring data, switching traffic. Each tier buys down a different term, and the arithmetic says which upgrade is worth it.",
    workload: { name: "Order API", dataGb: 300, computeCredits: 800 },
    requirement: { rtoMinutes: 60, rpoMinutes: 60, budgetCredits: 500 },
    start: { backup: "daily-snapshot", standby: "cold", trigger: "manual", restoreTested: true },
    hints: ["The recovery point comes only from the backup cadence: daily cannot meet one hour.", "With a cold standby the hour is gone before the restore even starts; look at the timeline.", "Hourly snapshots, a warm standby and automatic failover come to 34 minutes and 345 credits."],
    solution: { backup: "hourly-snapshot", standby: "warm", trigger: "automatic", restoreTested: true },
  },
  {
    id: "dr-03-payments",
    title: "Five minutes, two minutes, no excuses",
    brief: "The payments ledger must be serving again within five minutes and may lose at most two minutes of transactions. Budget is 2,500 credits a month. Build the plan.",
    teaches: "Tight objectives force continuous replication and a hot standby with automatic failover; a warm standby's scale-up alone already blows a five-minute window.",
    workload: { name: "Payments ledger", dataGb: 500, computeCredits: 1500 },
    requirement: { rtoMinutes: 5, rpoMinutes: 2, budgetCredits: 2500 },
    start: { backup: "hourly-snapshot", standby: "warm", trigger: "automatic", restoreTested: true },
    hints: ["Only continuous replication gets the recovery point under two minutes.", "A warm standby takes 15 minutes to scale up; the window is five.", "Hot standby plus automatic failover: 1 + 3 + 0 + 1 minutes."],
    solution: { backup: "continuous-replication", standby: "hot", trigger: "automatic", restoreTested: true },
  },
  {
    id: "dr-04-untested",
    title: "A backup nobody has restored",
    brief: "The internal wiki has hourly snapshots and a cold standby, and it fits the budget, but nobody has ever restored it. The requirement is four hours either way. Make it a plan the gate accepts: describe the restore, not just the backup.",
    teaches: "A backup that has never been restored is not known to work. The restore drill costs a little and is what turns a backup into a recovery plan.",
    workload: { name: "Internal wiki", dataGb: 50, computeCredits: 200 },
    requirement: { rtoMinutes: 240, rpoMinutes: 240, budgetCredits: 150 },
    start: { backup: "hourly-snapshot", standby: "cold", trigger: "manual", restoreTested: false },
    hints: ["Every number already passes; read the one check that does not.", "Tick the restore drill."],
    solution: { backup: "hourly-snapshot", standby: "cold", trigger: "manual", restoreTested: true },
  },
  {
    id: "dr-05-restore-dominates",
    title: "Six terabytes do not restore in two hours",
    brief: "The media archive is 6,000 GB. It must be back within two hours and may lose at most an hour. The current plan looks reasonable on paper: hourly snapshots and a warm standby. Read the timeline and fix the plan for at most 1,200 credits.",
    teaches: "Restore throughput is the term people forget: at 20 GB a minute, six terabytes take five hours however fast the standby comes up. Replicating continuously removes the restore entirely, and then a cheaper standby suffices.",
    workload: { name: "Media archive", dataGb: 6000, computeCredits: 600 },
    requirement: { rtoMinutes: 120, rpoMinutes: 60, budgetCredits: 1200 },
    start: { backup: "hourly-snapshot", standby: "warm", trigger: "automatic", restoreTested: true },
    hints: ["Which step dominates the timeline? It is not the standby.", "Continuous replication means there is nothing to restore.", "With nothing to restore, a cold standby with manual failover comes in at 95 minutes and 820 credits."],
    solution: { backup: "continuous-replication", standby: "cold", trigger: "manual", restoreTested: true },
  },
];

export const DR_EXERCISE_BY_ID = new Map(DR_EXERCISES.map((e) => [e.id, e]));
