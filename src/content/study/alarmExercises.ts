import { BASELINE_CONFIG } from "../../engine/sim/model";
import type { Run } from "../../engine/alarms/evaluate";

/**
 * Metric alarm exercises on the simulated platform. Each gives runs (an
 * incident that must be caught within a deadline, healthy or noisy moments
 * that must not page) and a starting alarm set that is wrong in an
 * instructive way. `solution` is the reference the tests use; never shown.
 */
export interface AlarmExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  runs: Run[];
  start: string;
  hints: string[];
  solution: string;
}

const serverlessHealthy = {
  requestsPerSec: 300,
  workers: 8,
  cacheHitRate: 0.9,
  dbDegraded: false,
  deployInProgress: false,
  queueConsumers: 4,
  serverless: { durationMs: 120, reservedConcurrency: 60, provisionedConcurrency: 36, poisonRate: 0, maxReceiveCount: 3, dlqEnabled: true, timeoutRate: 0, asyncRetries: 2, handlerIdempotent: true },
};

export const ALARM_EXERCISES: AlarmExercise[] = [
  {
    id: "alarm-01-threshold",
    title: "Catch the stampede, not the deploy",
    brief: "The cache stampede incident must page within 30 seconds. A routine deploy, which adds a little latency for a couple of minutes, must not. The current alarm pages on every deploy.",
    teaches: "A threshold sits above normal variation, not just above the quiet baseline. Latency moves for many harmless reasons; the error rate moves when customers are failing.",
    runs: [
      { id: "stampede", label: "Cache stampede (incident)", kind: "incident", config: { ...BASELINE_CONFIG, requestsPerSec: 200, cacheHitRate: 0.3 }, queueDepth: 20, ticks: 60, expect: { alert: "fire" }, deadline: 30, why: "Most requests miss the cache and overload the database: errors around 10%, p95 near a second." },
      { id: "baseline", label: "Normal morning", kind: "healthy", config: BASELINE_CONFIG, ticks: 60, expect: { alert: "quiet" }, why: "Nothing wrong; p95 around 190 ms, no errors." },
      { id: "deploy", label: "Routine deploy in progress", kind: "noise", config: { ...BASELINE_CONFIG, deployInProgress: true }, ticks: 60, expect: { alert: "quiet" }, why: "A deploy adds about 60 ms and 1% errors while it runs; p95 around 330 ms. Not an incident." },
    ],
    start: "alert: latencyP95 > 300 for 1 of 1",
    hints: ["Open the deploy run: its p95 sits around 330 ms the whole time, so a 300 ms threshold fires on every deploy.", "Either raise the latency threshold above a deploy's level, or alarm on the error rate, which a deploy barely moves.", "alert: errorRate > 0.03 for 3 of 3"],
    solution: "alert: errorRate > 0.03 for 3 of 3",
  },
  {
    id: "alarm-02-periods",
    title: "A blip is not an outage",
    brief: "The partner traffic surge must page within 30 seconds. A two-second traffic blip, which the platform absorbs, must not. The current alarm fires on a single bad second.",
    teaches: "Evaluation periods: requiring several consecutive breaching seconds filters blips without delaying the page much on a real, sustained failure.",
    runs: [
      { id: "surge", label: "Partner traffic surge (incident)", kind: "incident", config: { ...BASELINE_CONFIG, requestsPerSec: 500, queueConsumers: 4 }, queueDepth: 60, ticks: 60, expect: { alert: "fire" }, deadline: 30, why: "500 requests per second against four workers: errors around 60% for as long as it lasts." },
      { id: "blip", label: "Two-second traffic blip", kind: "noise", config: BASELINE_CONFIG, changes: [{ atTick: 10, patch: { requestsPerSec: 400 } }, { atTick: 12, patch: { requestsPerSec: 120 } }], ticks: 60, expect: { alert: "quiet" }, why: "Two seconds at 400 requests per second, then back to normal. Errors spike for two seconds and vanish." },
      { id: "baseline", label: "Normal morning", kind: "healthy", config: BASELINE_CONFIG, ticks: 60, expect: { alert: "quiet" }, why: "Nothing wrong." },
    ],
    start: "alert: errorRate > 0.03 for 1 of 1",
    hints: ["Open the blip run: two seconds breach, then nothing. A 1-of-1 alarm fires on the first.", "Ask for three breaching seconds in a row: the blip never gets there, the surge does by second three.", "alert: errorRate > 0.03 for 3 of 3"],
    solution: "alert: errorRate > 0.03 for 3 of 3",
  },
  {
    id: "alarm-03-right-metric",
    title: "Dead consumers: the API looks fine",
    brief: "The billing queue has no consumers and is growing; the API's own metrics stay perfect. A burst of jobs that the consumers drain within a minute must not page. Alarm on the right metric.",
    teaches: "Every failure has a metric that moves first. A queue with no consumers shows nothing on the request path; queue depth is the signal, and a burst that drains distinguishes itself by not staying high.",
    runs: [
      { id: "dead", label: "No consumers (incident)", kind: "incident", config: { ...BASELINE_CONFIG, queueConsumers: 0 }, queueDepth: 900, ticks: 60, expect: { alert: "fire" }, deadline: 30, why: "Jobs arrive at 36 per second and nothing drains them; depth climbs from 900. Errors and latency stay at zero." },
      { id: "burst", label: "Job burst that drains", kind: "noise", config: BASELINE_CONFIG, queueDepth: 450, ticks: 60, expect: { alert: "quiet" }, why: "A burst left 450 jobs queued; two consumers drain 14 a second net, so it is gone in about half a minute." },
      { id: "baseline", label: "Normal morning", kind: "healthy", config: BASELINE_CONFIG, ticks: 60, expect: { alert: "quiet" }, why: "Nothing wrong." },
    ],
    start: "alert: errorRate > 0.03 for 3 of 3",
    hints: ["Open the incident run: error rate and p95 never move. The alarm cannot fire.", "Queue depth is what grows. Pick a threshold the draining burst drops under quickly, and ask for it to stay high.", "alert: queueDepth > 300 for 15 of 15"],
    solution: "alert: queueDepth > 300 for 15 of 15",
  },
  {
    id: "alarm-04-replica",
    title: "Stale map: watch the replica, not the CPU",
    brief: "Dispatchers see positions a minute old because the read replica is blocked. A ten-second block, which the replica catches up from in seconds, must not page. The current alarm watches worker CPU, which never moves.",
    teaches: "Choose the metric that measures the customer-visible condition: map reads go stale when replica lag passes five seconds, so lag is the metric, with a threshold and duration that let a short block pass.",
    runs: [
      { id: "blocked", label: "Replica blocked (incident)", kind: "incident", config: { ...BASELINE_CONFIG, requestsPerSec: 150, replicaBlocked: true }, queueDepth: 20, replicaLag: 45, ticks: 60, expect: { alert: "fire" }, deadline: 30, why: "A long statement holds a lock the replica needs; lag starts at 45 s and grows one second per second." },
      { id: "short-block", label: "Ten-second block", kind: "noise", config: { ...BASELINE_CONFIG, replicaBlocked: true }, changes: [{ atTick: 10, patch: { replicaBlocked: false } }], ticks: 60, expect: { alert: "quiet" }, why: "A statement blocks the replica for ten seconds; lag reaches 10 s, then falls two seconds per second." },
      { id: "baseline", label: "Normal morning", kind: "healthy", config: BASELINE_CONFIG, ticks: 60, expect: { alert: "quiet" }, why: "Nothing wrong." },
    ],
    start: "alert: cpu > 70 for 3 of 3",
    hints: ["Open the incident run: CPU is flat. The failure is in replication.", "replicaLag is the metric; the short block peaks at 10 s, the incident starts at 45 s.", "alert: replicaLag > 30 for 5 of 5"],
    solution: "alert: replicaLag > 30 for 5 of 5",
  },
  {
    id: "alarm-05-function",
    title: "Throttled function, cold-start morning",
    brief: "The positions function is throttled by a concurrency limit far below what the traffic needs. The same function after a deploy, with a few seconds of cold starts, must not page. Alarm on throttling.",
    teaches: "On a function platform throttling and cold starts are different failures with different metrics; the concurrency limit is the one that drops requests.",
    runs: [
      { id: "throttled", label: "Concurrency limit too low (incident)", kind: "incident", config: { ...serverlessHealthy, serverless: { ...serverlessHealthy.serverless, reservedConcurrency: 10, provisionedConcurrency: 0 } }, queueDepth: 30, serverless: { warmEnvironments: 10 }, ticks: 60, expect: { alert: "fire" }, deadline: 30, why: "300 invocations a second at 120 ms need 36 concurrent executions; the limit is 10, so about 72% are throttled." },
      { id: "cold", label: "Cold starts after a deploy", kind: "noise", config: { ...serverlessHealthy, serverless: { ...serverlessHealthy.serverless, provisionedConcurrency: 0 } }, queueDepth: 30, serverless: { warmEnvironments: 0 }, ticks: 60, expect: { alert: "quiet" }, why: "A deploy replaced every execution environment, so all 36 start cold; they warm up at two per second, so p95 spikes near a second and settles within twenty seconds. Nothing is rejected." },
      { id: "healthy", label: "Healthy function", kind: "healthy", config: serverlessHealthy, queueDepth: 30, serverless: { warmEnvironments: 36 }, ticks: 60, expect: { alert: "quiet" }, why: "Limit 60, 36 warm environments, no throttling." },
    ],
    start: "alert: latencyP95 > 400 for 3 of 3",
    hints: ["Open the cold-start run: p95 jumps while environments warm up, then settles. Latency alone cannot tell the two apart.", "fn.throttleRate is the share of invocations the limit rejects.", "alert: fn.throttleRate > 0.05 for 3 of 3"],
    solution: "alert: fn.throttleRate > 0.05 for 3 of 3",
  },
  {
    id: "alarm-06-severity",
    title: "Ticket or page: two alarms, two severities",
    brief: "A degraded database (4% errors, slow queries) deserves a ticket, not a 3 a.m. page. The traffic surge (60% errors) deserves the page. Define a \"warn\" alarm that catches both and a \"page\" alarm that fires only for the surge, using a composite condition.",
    teaches: "Severity tiers: a composite alarm that requires both a high error rate and high latency pages only when customers are failing at scale; a looser single alarm opens a ticket for the rest.",
    runs: [
      { id: "surge", label: "Partner traffic surge (incident)", kind: "incident", config: { ...BASELINE_CONFIG, requestsPerSec: 500, queueConsumers: 4 }, queueDepth: 60, ticks: 60, expect: { warn: "fire", page: "fire" }, deadline: 30, why: "Errors around 60%, p95 well over a second." },
      { id: "degraded-db", label: "Degraded database", kind: "incident", config: { ...BASELINE_CONFIG, dbDegraded: true }, ticks: 60, expect: { warn: "fire", page: "quiet" }, deadline: 30, why: "Queries cost four times as much: 4% errors, p95 near 600 ms. Worth a ticket, not a page." },
      { id: "baseline", label: "Normal morning", kind: "healthy", config: BASELINE_CONFIG, ticks: 60, expect: { warn: "quiet", page: "quiet" }, why: "Nothing wrong." },
    ],
    start: "warn: errorRate > 0.03 for 3 of 3\npage: errorRate > 0.03 for 3 of 3",
    hints: ["Both alarms are the same rule, so the degraded database pages.", "The page needs a higher error threshold, and a second condition joined with 'and' makes it stricter still.", "page: errorRate > 0.2 for 3 of 3 and latencyP95 > 1000 for 3 of 3"],
    solution: "warn: errorRate > 0.03 for 3 of 3\npage: errorRate > 0.2 for 3 of 3 and latencyP95 > 1000 for 3 of 3",
  },
];

export const ALARM_EXERCISE_BY_ID = new Map(ALARM_EXERCISES.map((e) => [e.id, e]));
