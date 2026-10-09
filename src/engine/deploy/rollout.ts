/**
 * Deployment strategy simulator for the fictional platform. A release goes
 * out to a fleet under a strategy (all at once, rolling batches, a canary
 * first, or a second fleet with a traffic switch) with a guard (an
 * error-rate alarm with an evaluation window and optional automatic
 * rollback). The simulation runs second by second: how much traffic the new
 * version serves, how much capacity is left while instances restart and
 * whether the rest can absorb the load, what error rate customers see when
 * the release has a defect, when the alarm fires, how long the rollback
 * takes, and what a second fleet costs. Vendor-neutral; the numbers are the
 * platform's own.
 */
export type Strategy =
  | { kind: "all-at-once" }
  | { kind: "rolling"; batchPercent: number; bakeSeconds: number }
  | { kind: "canary"; canaryPercent: number; bakeSeconds: number; batchPercent: number }
  | { kind: "blue-green"; bakeSeconds: number };

export interface Release {
  name: string;
  /** Null for a good release. */
  defect: { errorRate: number; appearsAfterSeconds: number; visibleToSyntheticChecks: boolean } | null;
}

export interface Fleet {
  requestsPerSec: number;
  /** Seconds an instance takes to restart on the new version. */
  restartSeconds: number;
  /** Seconds to build a whole second fleet. */
  buildSeconds: number;
  /** Spare capacity in normal operation, as a share: 0.4 means the fleet runs at 60% and can lose 40% of itself without failing requests. */
  headroom: number;
}

export interface Guard {
  alarmErrorRate: number;
  evaluationSeconds: number;
  autoRollback: boolean;
}

export interface Tick {
  t: number;
  phase: string;
  shareNew: number;
  capacityShare: number;
  errorRate: number;
  inAlarm: boolean;
  extraFleetShare: number;
}

export interface RolloutResult {
  ticks: Tick[];
  completed: boolean;
  rolledBack: boolean;
  finishedAt: number;
  failedRequests: number;
  minCapacityShare: number;
  alarmAt: number | null;
  extraFleetSeconds: number;
}

const MAX_SECONDS = 1800;
const EPS = 1e-6;

type Step = { kind: "move"; share: number; bake: number; label: string } | { kind: "build" } | { kind: "bg-bake"; seconds: number } | { kind: "switch" };

function planSteps(strategy: Strategy): Step[] {
  const steps: Step[] = [];
  const batches = (first: number, size: number, bake: number, label: (i: number) => string) => {
    let done = first;
    let i = 1;
    while (done < 1 - EPS) {
      const m = Math.min(size, 1 - done);
      done += m;
      steps.push({ kind: "move", share: m, bake, label: label(i++) });
    }
  };
  switch (strategy.kind) {
    case "all-at-once":
      steps.push({ kind: "move", share: 1, bake: 0, label: "replace every instance" });
      break;
    case "rolling":
      batches(0, Math.min(100, Math.max(1, strategy.batchPercent)) / 100, strategy.bakeSeconds, (i) => `batch ${i}`);
      break;
    case "canary": {
      const c = Math.min(50, Math.max(1, strategy.canaryPercent)) / 100;
      steps.push({ kind: "move", share: c, bake: strategy.bakeSeconds, label: "canary" });
      batches(c, Math.min(100, Math.max(1, strategy.batchPercent)) / 100, 0, (i) => `batch ${i}`);
      break;
    }
    case "blue-green":
      steps.push({ kind: "build" }, { kind: "bg-bake", seconds: strategy.bakeSeconds }, { kind: "switch" });
      break;
  }
  return steps;
}

export function simulateRollout(fleet: Fleet, release: Release, strategy: Strategy, guard: Guard): RolloutResult {
  const steps = planSteps(strategy);
  const ticks: Tick[] = [];
  const breaches: boolean[] = [];
  let shareNew = 0;
  let restarting = 0;
  let moving = 0;
  let movingToNew = true;
  let timer = 0;
  let bakeAfter = 0;
  let sub: "idle" | "restart" | "bake" | "build" | "bg-bake" | "observe" = "idle";
  let stepIndex = 0;
  let phase = "start";
  let rolledBack = false;
  let completed = false;
  let switched = false;
  let extra = 0;
  let bgBakeStart = 0;
  let alarmAt: number | null = null;
  let failed = 0;
  let minCap = 1;
  let extraSeconds = 0;
  const stepBack = strategy.kind === "all-at-once" ? 1 : 0.25;
  const finish = (t: number): RolloutResult => ({ ticks, completed: completed && !rolledBack, rolledBack, finishedAt: t, failedRequests: Math.round(failed), minCapacityShare: minCap, alarmAt, extraFleetSeconds: extraSeconds });

  for (let t = 0; t < MAX_SECONDS; t++) {
    if (sub === "idle") {
      if (rolledBack) {
        if (shareNew > EPS) {
          moving = Math.min(stepBack, shareNew);
          movingToNew = false;
          shareNew -= moving; // taken out of service first
          restarting += moving;
          timer = fleet.restartSeconds;
          sub = "restart";
          phase = "rolling back";
        } else return finish(t);
      } else if (completed) {
        return finish(t);
      } else if (stepIndex < steps.length) {
        const s = steps[stepIndex++];
        if (s.kind === "move") {
          moving = s.share;
          movingToNew = true;
          restarting += moving;
          timer = fleet.restartSeconds;
          bakeAfter = s.bake;
          sub = "restart";
          phase = s.label;
        } else if (s.kind === "build") {
          extra = 1;
          timer = fleet.buildSeconds;
          sub = "build";
          phase = "building the second fleet";
        } else if (s.kind === "bg-bake") {
          timer = s.seconds;
          bgBakeStart = t;
          sub = s.seconds > 0 ? "bg-bake" : "idle";
          phase = "synthetic checks on the second fleet";
        } else {
          shareNew = 1;
          switched = true;
          timer = guard.evaluationSeconds + 5;
          sub = "observe";
          phase = "traffic on the second fleet";
        }
      } else {
        completed = true;
        phase = "complete";
      }
    }

    // Customer view this second.
    const capacityShare = Math.max(0, 1 - restarting);
    const capacityFail = Math.max(0, 1 - capacityShare / Math.max(EPS, 1 - fleet.headroom));
    const defectActive = release.defect !== null && t >= release.defect.appearsAfterSeconds;
    const defectFail = defectActive && release.defect ? shareNew * release.defect.errorRate : 0;
    const errorRate = Math.min(1, capacityFail + defectFail);
    failed += errorRate * fleet.requestsPerSec;
    minCap = Math.min(minCap, capacityShare);
    extraSeconds += extra;

    // Synthetic checks on the second fleet see a visible defect before any customer does.
    if (sub === "bg-bake" && release.defect?.visibleToSyntheticChecks && t - bgBakeStart >= release.defect.appearsAfterSeconds) {
      rolledBack = true;
      extra = 0;
      sub = "idle";
      phase = "synthetic checks failed: second fleet discarded";
    }

    // Alarm on what customers see.
    breaches.push(errorRate > guard.alarmErrorRate);
    const window = breaches.slice(-guard.evaluationSeconds);
    const inAlarm = window.length >= guard.evaluationSeconds && window.every(Boolean);
    if (inAlarm && alarmAt === null) alarmAt = t;
    if (inAlarm && guard.autoRollback && !rolledBack) {
      rolledBack = true;
      completed = false;
      if (switched) {
        shareNew = 0; // the switch back is a routing change
        extra = 0;
        sub = "idle";
        phase = "switched back to the first fleet";
      } else if (sub === "bake" || sub === "observe") {
        sub = "idle";
      } else if (sub === "build" || sub === "bg-bake") {
        extra = 0;
        sub = "idle";
        phase = "second fleet discarded";
      }
      // A batch mid-restart finishes landing, then the idle handler moves everything back.
    }

    ticks.push({ t, phase, shareNew, capacityShare, errorRate, inAlarm, extraFleetShare: extra });

    // Timers.
    if (sub === "restart") {
      timer--;
      if (timer <= 0) {
        restarting -= moving;
        if (movingToNew) shareNew = Math.min(1, shareNew + moving);
        moving = 0;
        if (!rolledBack && bakeAfter > 0) {
          timer = bakeAfter;
          sub = "bake";
          phase = `${phase} (baking)`;
        } else sub = "idle";
      }
    } else if (sub === "bake" || sub === "build" || sub === "bg-bake" || sub === "observe") {
      timer--;
      if (timer <= 0) {
        if (sub === "observe") completed = true;
        sub = "idle";
      }
    }
  }
  return finish(MAX_SECONDS);
}

export interface RolloutRequirement {
  minCapacityShare: number;
  failedRequestsBudget: number;
  finishWithinSeconds: number;
  extraFleetSecondsBudget: number;
}

export interface RolloutCheck {
  id: "capacity" | "failed" | "outcome" | "time" | "cost";
  label: string;
  passed: boolean;
  detail: string;
}

export function checkRollout(fleet: Fleet, release: Release, strategy: Strategy, guard: Guard, req: RolloutRequirement): { result: RolloutResult; checks: RolloutCheck[] } {
  const result = simulateRollout(fleet, release, strategy, guard);
  const bad = release.defect !== null;
  const checks: RolloutCheck[] = [
    { id: "capacity", label: `At least ${Math.round(req.minCapacityShare * 100)}% of the fleet stays in service`, passed: result.minCapacityShare >= req.minCapacityShare - 1e-9, detail: `lowest point ${Math.round(result.minCapacityShare * 100)}%${result.minCapacityShare < 1 - fleet.headroom - 1e-9 ? ", below what the headroom can absorb, so requests failed" : ""}` },
    { id: "failed", label: `At most ${req.failedRequestsBudget} requests fail`, passed: result.failedRequests <= req.failedRequestsBudget, detail: `${result.failedRequests} failed (${bad ? "defect exposure plus any capacity gap" : "capacity gaps only"})` },
    { id: "outcome", label: bad ? "The bad release is rolled back" : "The good release completes", passed: bad ? result.rolledBack : result.completed, detail: bad ? (result.rolledBack ? `rolled back${result.alarmAt !== null ? `; alarm fired at ${result.alarmAt + 1} s` : " by the synthetic checks, before any customer traffic"}` : result.alarmAt === null ? "the alarm never fired, so the defect reached everyone" : "the alarm fired but nothing rolled back automatically") : result.completed ? "every instance serves the new version" : result.rolledBack ? "a good release was rolled back: the guard read a capacity gap as a defect" : `not finished within ${MAX_SECONDS} s` },
    { id: "time", label: `Done within ${req.finishWithinSeconds} s`, passed: result.finishedAt <= req.finishWithinSeconds, detail: `${result.rolledBack ? "rolled back" : result.completed ? "completed" : "still going"} at ${result.finishedAt} s` },
    { id: "cost", label: `Second fleet within ${req.extraFleetSecondsBudget} fleet-seconds`, passed: result.extraFleetSeconds <= req.extraFleetSecondsBudget, detail: result.extraFleetSeconds ? `${result.extraFleetSeconds} fleet-seconds of a second fleet` : "no second fleet" },
  ];
  return { result, checks };
}

export function describeStrategy(s: Strategy): string {
  switch (s.kind) {
    case "all-at-once":
      return "all at once";
    case "rolling":
      return `rolling, ${s.batchPercent}% batches, ${s.bakeSeconds} s bake`;
    case "canary":
      return `canary ${s.canaryPercent}% for ${s.bakeSeconds} s, then ${s.batchPercent}% batches`;
    case "blue-green":
      return `second fleet, ${s.bakeSeconds} s of synthetic checks, then switch`;
  }
}
