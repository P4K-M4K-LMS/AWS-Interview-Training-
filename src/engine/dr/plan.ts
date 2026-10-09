/**
 * Disaster-recovery planner for the fictional platform. Vendor-neutral: a
 * backup cadence, a standby tier, a failover trigger and a restore test,
 * each with a cost in fictional credits per month and a contribution to the
 * recovery timeline. Everything is arithmetic the learner can check: the
 * recovery point is the backup interval, the recovery time is the sum of
 * detection, provisioning, data restore and cutover, and the planner can
 * name the cheapest plan that meets a requirement so over-spending is as
 * visible as falling short.
 */
export type BackupCadence = "daily-snapshot" | "hourly-snapshot" | "continuous-replication";
export type Standby = "none" | "cold" | "warm" | "hot";
export type Trigger = "manual" | "automatic";

export interface Workload {
  name: string;
  dataGb: number;
  /** Credits per month to run the workload at full scale (what a hot standby costs). */
  computeCredits: number;
}

export interface DrPlan {
  backup: BackupCadence;
  standby: Standby;
  trigger: Trigger;
  /** A scheduled restore drill. An untested backup is a hope, not a plan. */
  restoreTested: boolean;
}

export interface DrRequirement {
  rtoMinutes: number;
  rpoMinutes: number;
  budgetCredits: number;
}

export interface TimelineStep {
  id: "detect" | "provision" | "restore" | "cutover";
  label: string;
  minutes: number;
  why: string;
}

export interface DrDerived {
  rpoMinutes: number;
  rtoMinutes: number;
  costCredits: number;
  costBreakdown: Array<{ item: string; credits: number }>;
  timeline: TimelineStep[];
  dominant: TimelineStep["id"];
}

export const BACKUP_OPTIONS: Record<BackupCadence, { label: string; rpoMinutes: number; perGb: number; base: number; what: string }> = {
  "daily-snapshot": { label: "Daily snapshot to a second site", rpoMinutes: 1440, perGb: 0.02, base: 10, what: "One copy a day. Up to a day of changes can be lost, and data must be restored from the snapshot before anything runs." },
  "hourly-snapshot": { label: "Hourly snapshot to a second site", rpoMinutes: 60, perGb: 0.05, base: 25, what: "A copy every hour. Up to an hour lost; data still has to be restored from the snapshot." },
  "continuous-replication": { label: "Continuous replication to a live copy", rpoMinutes: 1, perGb: 0.12, base: 60, what: "Every change streams to a second copy within about a minute. Nothing to restore: the copy is already there." },
};

export const STANDBY_OPTIONS: Record<Standby, { label: string; provisionMinutes: number; computeShare: number; what: string }> = {
  none: { label: "No standby (rebuild from scratch)", provisionMinutes: 240, computeShare: 0, what: "Nothing exists at the second site until the disaster; everything is built then." },
  cold: { label: "Cold standby (templates ready, nothing running)", provisionMinutes: 60, computeShare: 0.05, what: "Infrastructure is defined and can be created in about an hour; only the smallest pieces run." },
  warm: { label: "Warm standby (scaled-down copy running)", provisionMinutes: 15, computeShare: 0.35, what: "A small version runs all the time and is scaled up in minutes." },
  hot: { label: "Hot standby (full copy serving)", provisionMinutes: 1, computeShare: 1, what: "A full second deployment is already serving; failover is a routing change." },
};

export const TRIGGER_OPTIONS: Record<Trigger, { label: string; detectMinutes: number; cutoverMinutes: number; credits: number; what: string }> = {
  manual: { label: "Manual (someone decides)", detectMinutes: 30, cutoverMinutes: 5, credits: 0, what: "An on-call engineer notices, confirms and switches traffic." },
  automatic: { label: "Automatic (health checks decide)", detectMinutes: 3, cutoverMinutes: 1, credits: 15, what: "Health checks fail over on their own; costs a little to run them." },
};

export const RESTORE_TEST_CREDITS = 10;
/** Snapshot restore throughput in GB per minute. */
export const RESTORE_GB_PER_MINUTE = 20;

export function evaluatePlan(workload: Workload, plan: DrPlan): DrDerived {
  const backup = BACKUP_OPTIONS[plan.backup];
  const standby = STANDBY_OPTIONS[plan.standby];
  const trigger = TRIGGER_OPTIONS[plan.trigger];
  const restoreMinutes = plan.backup === "continuous-replication" ? 0 : Math.ceil(workload.dataGb / RESTORE_GB_PER_MINUTE);
  const timeline: TimelineStep[] = [
    { id: "detect", label: "Detect and decide", minutes: trigger.detectMinutes, why: trigger.what },
    { id: "provision", label: "Bring up the standby", minutes: standby.provisionMinutes, why: standby.what },
    { id: "restore", label: "Restore the data", minutes: restoreMinutes, why: restoreMinutes ? `${workload.dataGb} GB from the latest snapshot at ${RESTORE_GB_PER_MINUTE} GB per minute` : "nothing to restore: the replicated copy is already current" },
    { id: "cutover", label: "Switch traffic", minutes: trigger.cutoverMinutes, why: plan.trigger === "automatic" ? "routing changes as soon as the checks fail" : "an engineer changes the routing by hand" },
  ];
  const rtoMinutes = timeline.reduce((a, s) => a + s.minutes, 0);
  const dominant = [...timeline].sort((a, b) => b.minutes - a.minutes)[0].id;
  const costBreakdown = [
    { item: backup.label, credits: Math.round(backup.base + backup.perGb * workload.dataGb) },
    { item: standby.label, credits: Math.round(standby.computeShare * workload.computeCredits) },
    { item: trigger.label, credits: trigger.credits },
    { item: plan.restoreTested ? "Monthly restore drill" : "No restore drill", credits: plan.restoreTested ? RESTORE_TEST_CREDITS : 0 },
  ];
  return { rpoMinutes: backup.rpoMinutes, rtoMinutes, costCredits: costBreakdown.reduce((a, c) => a + c.credits, 0), costBreakdown, timeline, dominant };
}

export const ALL_PLANS: DrPlan[] = (Object.keys(BACKUP_OPTIONS) as BackupCadence[]).flatMap((backup) =>
  (Object.keys(STANDBY_OPTIONS) as Standby[]).flatMap((standby) => (Object.keys(TRIGGER_OPTIONS) as Trigger[]).map((trigger) => ({ backup, standby, trigger, restoreTested: true }))),
);

export function meets(derived: DrDerived, req: DrRequirement): boolean {
  return derived.rtoMinutes <= req.rtoMinutes && derived.rpoMinutes <= req.rpoMinutes && derived.costCredits <= req.budgetCredits;
}

/** The cheapest tested plan that meets the requirement, if any does. */
export function cheapestFeasible(workload: Workload, req: DrRequirement): { plan: DrPlan; derived: DrDerived } | undefined {
  let best: { plan: DrPlan; derived: DrDerived } | undefined;
  for (const plan of ALL_PLANS) {
    const derived = evaluatePlan(workload, plan);
    if (!meets(derived, req)) continue;
    if (!best || derived.costCredits < best.derived.costCredits) best = { plan, derived };
  }
  return best;
}

export interface PlanCheck {
  id: "rpo" | "rto" | "budget" | "tested" | "lean";
  label: string;
  passed: boolean;
  detail: string;
}

/** Over-spending tolerance: a plan may cost up to this much more than the cheapest feasible one. */
export const LEAN_TOLERANCE = 1.2;

export function checkPlan(workload: Workload, req: DrRequirement, plan: DrPlan): { derived: DrDerived; checks: PlanCheck[]; cheapest?: { plan: DrPlan; derived: DrDerived } } {
  const derived = evaluatePlan(workload, plan);
  const cheapest = cheapestFeasible(workload, req);
  const checks: PlanCheck[] = [
    { id: "rpo", label: `Recovery point within ${fmt(req.rpoMinutes)}`, passed: derived.rpoMinutes <= req.rpoMinutes, detail: `this plan loses up to ${fmt(derived.rpoMinutes)} of changes (the backup interval)` },
    { id: "rto", label: `Recovery time within ${fmt(req.rtoMinutes)}`, passed: derived.rtoMinutes <= req.rtoMinutes, detail: `this plan takes ${fmt(derived.rtoMinutes)}: ${derived.timeline.map((s) => `${s.label.toLowerCase()} ${fmt(s.minutes)}`).join(", ")}` },
    { id: "budget", label: `Within ${req.budgetCredits} credits a month`, passed: derived.costCredits <= req.budgetCredits, detail: `this plan costs ${derived.costCredits} credits a month` },
    { id: "tested", label: "Restore is tested on a schedule", passed: plan.restoreTested, detail: plan.restoreTested ? "a monthly drill proves the restore, not just the backup" : "an untested backup is a hope; the gate asks you to describe the restore" },
    {
      id: "lean",
      label: "No more than needed",
      passed: cheapest ? derived.costCredits <= cheapest.derived.costCredits * LEAN_TOLERANCE : true,
      detail: cheapest ? `the cheapest plan that meets this requirement costs ${cheapest.derived.costCredits} credits (${describePlan(cheapest.plan)})` : "no plan meets this requirement at all; the requirement itself must change",
    },
  ];
  return { derived, checks, cheapest };
}

export function describePlan(plan: DrPlan): string {
  return `${BACKUP_OPTIONS[plan.backup].label.toLowerCase()}, ${STANDBY_OPTIONS[plan.standby].label.split(" (")[0].toLowerCase()}, ${plan.trigger} failover${plan.restoreTested ? ", tested" : ""}`;
}

export function fmt(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
