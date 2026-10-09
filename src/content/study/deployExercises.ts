import type { Fleet, Guard, Release, RolloutRequirement, Strategy } from "../../engine/deploy/rollout";

/**
 * Deployment strategy exercises. Each gives a fleet, a release (good or
 * defective), a requirement and a starting strategy and guard that fail in an
 * instructive way; the learner adjusts them until every check passes.
 * `solution` is the reference the tests use; never shown.
 */
export interface DeployExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  fleet: Fleet;
  release: Release;
  requirement: RolloutRequirement;
  start: { strategy: Strategy; guard: Guard };
  hints: string[];
  solution: { strategy: Strategy; guard: Guard };
}

const fleet: Fleet = { requestsPerSec: 200, restartSeconds: 20, buildSeconds: 60, headroom: 0.4 };
const good: Release = { name: "fleet-api v2.4.0 (good)", defect: null };
const guard = (over: Partial<Guard> = {}): Guard => ({ alarmErrorRate: 0.05, evaluationSeconds: 10, autoRollback: true, ...over });

export const DEPLOY_EXERCISES: DeployExercise[] = [
  {
    id: "deploy-01-all-at-once",
    title: "Replacing everything at once is an outage",
    brief: "A good release goes out by restarting every instance together. For the twenty seconds they restart, nobody is served. Keep at least three quarters of the capacity up throughout and finish within five minutes.",
    teaches: "Restarts are a capacity gap. A rolling deployment replaces a batch at a time so the rest keeps serving; the batch size sets how much capacity you give up and how long the rollout takes.",
    fleet,
    release: good,
    requirement: { minCapacityShare: 0.75, failedRequestsBudget: 1200, finishWithinSeconds: 300, extraFleetSecondsBudget: 0 },
    start: { strategy: { kind: "all-at-once" }, guard: guard({ autoRollback: false }) },
    hints: ["Open the timeline: capacity drops to 0% for twenty seconds and every request in that window fails.", "Rolling batches of 25% keep 75% serving; four batches of twenty seconds plus bake time.", "Rolling, 25% batches, a 10 s bake, finishes in about two minutes."],
    solution: { strategy: { kind: "rolling", batchPercent: 25, bakeSeconds: 10 }, guard: guard({ autoRollback: false }) },
  },
  {
    id: "deploy-02-canary",
    title: "A bad release meets a canary",
    brief: "This release fails 30% of the requests it serves, from the first second. Limit the damage: no more than 100 failed requests, rolled back within four minutes, with at least 90% of capacity up the whole time.",
    teaches: "A canary puts the new version in front of a small share of traffic first. If it fails, the blast radius is that share for as long as detection takes; the alarm's evaluation window is part of the exposure.",
    fleet,
    release: { name: "fleet-api v2.5.0 (defective)", defect: { errorRate: 0.3, appearsAfterSeconds: 0, visibleToSyntheticChecks: false } },
    requirement: { minCapacityShare: 0.9, failedRequestsBudget: 100, finishWithinSeconds: 240, extraFleetSecondsBudget: 0 },
    start: { strategy: { kind: "rolling", batchPercent: 25, bakeSeconds: 10 }, guard: guard() },
    hints: ["Open the timeline: the first 25% batch exposes a quarter of the traffic to a 30% failure rate, and 25% of capacity restarts at a time.", "A 5% canary exposes a twentieth of the traffic; the alarm still needs ten breaching seconds to fire.", "Canary 5%, 30 s bake, then 25% batches; alarm at 1% for 10 s with automatic rollback."],
    solution: { strategy: { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, guard: guard({ alarmErrorRate: 0.01, evaluationSeconds: 10 }) },
  },
  {
    id: "deploy-03-latent-defect",
    title: "The defect waits a minute",
    brief: "This release looks healthy for the first 60 seconds and then fails half of its requests. The canary bakes for 30 seconds, passes, and the first batch is already landing when the defect shows, so three times as much of the fleet has to be pulled back and the fleet dips below the 90% floor. Make the canary wait long enough.",
    teaches: "A bake time must be longer than the time a defect takes to show. A canary promoted before the defect appears protects nothing: when the alarm finally fires, the rollback has to undo the batches too, which costs capacity and time.",
    fleet,
    release: { name: "fleet-api v2.6.0 (latent defect)", defect: { errorRate: 0.5, appearsAfterSeconds: 60, visibleToSyntheticChecks: false } },
    requirement: { minCapacityShare: 0.9, failedRequestsBudget: 100, finishWithinSeconds: 300, extraFleetSecondsBudget: 0 },
    start: { strategy: { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 10 }, guard: guard({ alarmErrorRate: 0.01 }) },
    hints: ["Open the timeline: the canary is promoted at about 50 s and the first batch starts restarting; the defect appears at 60 s and the alarm fires at 70 s, so 15% of the fleet is rolled back at once.", "Bake the canary for longer than the defect's delay, so only the canary is ever on the new version when the alarm fires.", "Canary 5% with a 90 s bake, then 10% batches; alarm at 1% for 10 s."],
    solution: { strategy: { kind: "canary", canaryPercent: 5, bakeSeconds: 90, batchPercent: 10 }, guard: guard({ alarmErrorRate: 0.01 }) },
  },
  {
    id: "deploy-04-blue-green",
    title: "A broken configuration that checks can see",
    brief: "This release has a configuration error that fails 100% of requests, and a synthetic check would catch it. Customers must see zero failures. You may run a second fleet for up to two minutes.",
    teaches: "Building the new version as a second fleet and checking it before any customer traffic reaches it costs extra capacity for a while and buys zero exposure. The switch, and the switch back, are routing changes.",
    fleet,
    release: { name: "fleet-api v2.7.0 (bad configuration)", defect: { errorRate: 1, appearsAfterSeconds: 0, visibleToSyntheticChecks: true } },
    requirement: { minCapacityShare: 1, failedRequestsBudget: 0, finishWithinSeconds: 180, extraFleetSecondsBudget: 120 },
    start: { strategy: { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, guard: guard({ alarmErrorRate: 0.01 }) },
    hints: ["Even a 5% canary restarts 5% of the fleet and then fails every request it serves.", "A second fleet serves no customers until the switch; synthetic checks run against it first.", "Second fleet, 30 s of synthetic checks; the build takes 60 s."],
    solution: { strategy: { kind: "blue-green", bakeSeconds: 30 }, guard: guard() },
  },
  {
    id: "deploy-05-too-slow",
    title: "Careful is good, glacial is not",
    brief: "A good release rolls out in 5% batches with a two-minute bake each: safe, and over an hour long. Finish within ten minutes while keeping 75% of capacity and failing at most 1,000 requests.",
    teaches: "Batch size and bake time trade speed for safety. For a release that has passed its canary elsewhere, bigger batches with a short bake finish in minutes without touching the capacity floor.",
    fleet,
    release: good,
    requirement: { minCapacityShare: 0.75, failedRequestsBudget: 1000, finishWithinSeconds: 600, extraFleetSecondsBudget: 0 },
    start: { strategy: { kind: "rolling", batchPercent: 5, bakeSeconds: 120 }, guard: guard({ autoRollback: false }) },
    hints: ["Twenty batches of twenty seconds plus twenty bakes of two minutes: forty-six minutes.", "The capacity floor is 75%, so batches can be 25%.", "Rolling, 25% batches, 30 s bake: under four minutes."],
    solution: { strategy: { kind: "rolling", batchPercent: 25, bakeSeconds: 30 }, guard: guard({ autoRollback: false }) },
  },
  {
    id: "deploy-06-guard",
    title: "An alarm that never fires",
    brief: "The canary is fine, but the guard is not: the alarm threshold is 50% errors and rollback is manual. This release fails 30% of its requests, so the alarm never fires and the canary is promoted. Fix the guard.",
    teaches: "The guard is part of the strategy. A threshold above the defect's effect never fires; without automatic rollback a firing alarm still waits for a human at 3 a.m.",
    fleet,
    release: { name: "fleet-api v2.8.0 (defective)", defect: { errorRate: 0.3, appearsAfterSeconds: 0, visibleToSyntheticChecks: false } },
    requirement: { minCapacityShare: 0.9, failedRequestsBudget: 100, finishWithinSeconds: 240, extraFleetSecondsBudget: 0 },
    start: { strategy: { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, guard: guard({ alarmErrorRate: 0.5, autoRollback: false }) },
    hints: ["Open the timeline: the canary serves 5% of traffic at a 30% failure rate, so customers see 1.5% errors; a 50% threshold never trips.", "Set the threshold below what the canary makes visible, and turn automatic rollback on.", "Alarm at 1% for 10 s with automatic rollback; keep the 5% canary."],
    solution: { strategy: { kind: "canary", canaryPercent: 5, bakeSeconds: 30, batchPercent: 25 }, guard: guard({ alarmErrorRate: 0.01, evaluationSeconds: 10, autoRollback: true }) },
  },
];

export const DEPLOY_EXERCISE_BY_ID = new Map(DEPLOY_EXERCISES.map((e) => [e.id, e]));
