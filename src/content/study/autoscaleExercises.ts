import type { Config, Requirement, Scenario } from "../../engine/autoscale/simulate";

/**
 * Autoscaling exercises. Each fixes a fleet, a demand curve and a
 * requirement and starts from a configuration that fails in an instructive
 * way; the learner changes the configuration until every check passes.
 * `solution` is the reference the tests run; never shown.
 */
export interface AutoscaleExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  scenario: Scenario;
  requirement: Requirement;
  start: Config;
  hints: string[];
  solution: Config;
}

const fleet = (over: Partial<Scenario["fleet"]> = {}): Scenario["fleet"] => ({ perInstanceRps: 20, warmupSeconds: 60, cpuAtCapacity: 1, ...over });
const hc = (intervalSeconds = 30, unhealthyThreshold = 3) => ({ intervalSeconds, unhealthyThreshold });
const target = (over: Partial<Extract<Config["policy"], { kind: "target" }>> = {}): Config["policy"] => ({ kind: "target", metric: "cpu", target: 0.7, countWarming: true, scaleInCooldownSeconds: 300, ...over });
const cfg = (over: Partial<Config> = {}): Config => ({ min: 4, max: 40, policy: { kind: "none" }, schedule: [], healthCheck: hc(), ...over });

export const AUTOSCALE_EXERCISES: AutoscaleExercise[] = [
  {
    id: "as-01-elastic",
    title: "A fixed fleet is wrong twice a day",
    brief: "Traffic climbs from 40 to 200 requests per second over ten minutes and stays there. Four instances (20 req/s each) are fine at night and drown in the morning; twelve would cope and sit idle at night. Serve everyone with at most 60 slow seconds, within 13,000 instance-seconds.",
    teaches: "Elasticity is capacity that follows demand. A target-tracking policy keeps a metric near a target by adding instances as demand rises and removing them as it falls; the target leaves headroom for the minute an instance takes to warm up.",
    scenario: { fleet: fleet(), demand: [{ at: 0, rps: 40 }, { at: 300, rps: 40 }, { at: 900, rps: 200 }, { at: 1200, rps: 200 }], seconds: 1200, faults: [], flapEveryNthCheck: null },
    requirement: { maxFailed: 0, maxSlowSeconds: 60, instanceSecondsBudget: 13000, maxScaleActions: 20 },
    start: cfg({ min: 4, max: 4 }),
    hints: ["Four instances serve 80 req/s; everything above that fails. Raising min and max to 12 serves everyone and costs 14,400 instance-seconds.", "Target tracking adds instances as the ramp climbs. At 70% CPU a three-instance fleet is briefly slow each time it waits for the next one; a lower target buys more headroom for the warm-up minute.", "Min 3, max 20, target tracking at 60% CPU with warming instances counted."],
    solution: cfg({ min: 3, max: 20, policy: target({ target: 0.6 }) }),
  },
  {
    id: "as-02-warmup",
    title: "Counting the instances that are still warming up",
    brief: "A surge from 60 to 300 requests per second in thirty seconds. The policy scales on the instances in service only, so for the whole minute a new instance takes to warm up the metric stays high and the policy keeps launching. The surge itself costs a warm-up minute of failures whatever you do; what you can stop is the runaway fleet: at most 8 scaling actions and 16,500 instance-seconds.",
    teaches: "An instance that is warming up is capacity already on its way. A policy that does not count it launches again for the same shortfall every evaluation, overshoots to the maximum, then scales back in: thrash and a bill for instances that never served a request.",
    scenario: { fleet: fleet(), demand: [{ at: 0, rps: 60 }, { at: 200, rps: 60 }, { at: 230, rps: 300 }, { at: 600, rps: 300 }, { at: 630, rps: 60 }, { at: 1200, rps: 60 }], seconds: 1200, faults: [], flapEveryNthCheck: null },
    requirement: { maxFailed: 13000, maxSlowSeconds: 120, instanceSecondsBudget: 16500, maxScaleActions: 8 },
    start: cfg({ min: 4, max: 40, policy: target({ countWarming: false }) }),
    hints: ["Watch the instance line: it climbs to the maximum within the warm-up minute, long past the 22 the surge needs.", "Count the warming instances when estimating the metric: the first launch covers the shortfall, the next evaluations see it coming.", "Target tracking at 70% CPU with warming instances counted; min 4, max 40."],
    solution: cfg({ min: 4, max: 40, policy: target({ countWarming: true }) }),
  },
  {
    id: "as-03-flash-sale",
    title: "A sale announced for noon",
    brief: "Everyone knows the sale starts at 300 s: demand jumps from 50 to 400 requests per second in ten seconds and stays for five minutes. Instances take two minutes to warm up. Target tracking alone reacts after the fact and the first two minutes fail. Keep failures under 500 within 16,000 instance-seconds.",
    teaches: "A reactive policy can only follow demand it has seen, and warm-up sets how far behind it runs. A known surge is scheduled: raise the minimum ahead of it so the capacity is warm when the demand arrives, and let the policy scale back in afterwards.",
    scenario: { fleet: fleet({ warmupSeconds: 120 }), demand: [{ at: 0, rps: 50 }, { at: 300, rps: 50 }, { at: 310, rps: 400 }, { at: 600, rps: 400 }, { at: 610, rps: 50 }, { at: 900, rps: 50 }], seconds: 900, faults: [], flapEveryNthCheck: null },
    requirement: { maxFailed: 500, maxSlowSeconds: 60, instanceSecondsBudget: 16000, maxScaleActions: 10 },
    start: cfg({ min: 3, max: 40, policy: target() }),
    hints: ["The instance line only starts climbing at 310 s and serves nothing new until 430 s; the demand line is far above capacity the whole time.", "A scheduled action raises the minimum at a time of your choosing; 29 instances serve 400 req/s at 70%.", "Keep target tracking; schedule a minimum of 29 at 170 s and a minimum of 3 at 620 s."],
    solution: cfg({ min: 3, max: 40, policy: target(), schedule: [{ at: 170, minimum: 29 }, { at: 620, minimum: 3 }] }),
  },
  {
    id: "as-04-thrash",
    title: "Scaling on every wobble",
    brief: "A quiet night at 60 requests per second, then a day of demand swinging between 100 and 160 every minute. Step scaling adds two instances after five seconds above 75% and removes two after five seconds below 65%, with no cooldown, so the fleet changes size on every swing and fails on every trough. Keep it steady: at most 10 scaling actions, no failures, at most 60 slow seconds, within 18,500 instance-seconds (twelve instances all day would cost 21,600).",
    teaches: "Evaluation periods and cooldowns are what stop a policy reacting to noise. A short wobble should not change the fleet; a sustained change should. Scaling in deserves more patience than scaling out, because the cost of being under is failures and the cost of being over is a little money.",
    scenario: { fleet: fleet({ warmupSeconds: 30 }), demand: [{ at: 0, rps: 60 }, { at: 540, rps: 60 }, ...Array.from({ length: 20 }, (_, i) => ({ at: 660 + i * 60, rps: i % 2 === 0 ? 100 : 160 }))], seconds: 1800, faults: [], flapEveryNthCheck: null },
    requirement: { maxFailed: 0, maxSlowSeconds: 60, instanceSecondsBudget: 18500, maxScaleActions: 10 },
    start: cfg({ min: 4, max: 20, policy: { kind: "step", metric: "cpu", up: { above: 0.75, add: 2 }, down: { below: 0.65, remove: 2 }, evaluationSeconds: 5, cooldownSeconds: 0 } }),
    hints: ["Count the actions: the fleet grows on every upswing and shrinks on every downswing, and the swing is a minute long.", "A longer evaluation period ignores the short peaks; a cooldown of a few minutes keeps the fleet where it is while the next swing passes.", "Target tracking at 70% CPU with a 600 s scale-in cooldown settles at the size the peaks need and stays there; min 6 so the morning ramp starts from a fleet that can absorb it."],
    solution: cfg({ min: 6, max: 20, policy: target({ scaleInCooldownSeconds: 600 }) }),
  },
  {
    id: "as-05-health",
    title: "Two hung instances and a flaky one",
    brief: "Ten instances serve a steady 150 requests per second. At 120 s two of them hang: they accept connections and answer nothing. The balancer keeps sending them a fifth of the traffic until the health check gives up on them, which takes five failed checks thirty seconds apart. One healthy instance also fails a single check now and then. Lose at most 700 requests, and throw no healthy instance away.",
    teaches: "A health check's interval times its unhealthy threshold is how long a dead instance keeps receiving traffic. Shorter is faster to detect; a threshold of one turns every transient failed check into a replacement and a warm-up, which is churn, not health.",
    scenario: { fleet: fleet({ warmupSeconds: 60 }), demand: [{ at: 0, rps: 150 }, { at: 600, rps: 150 }], seconds: 600, faults: [{ at: 120, instances: 2 }], flapEveryNthCheck: 6 },
    requirement: { maxFailed: 700, maxSlowSeconds: 90, instanceSecondsBudget: 6200, maxScaleActions: 4 },
    start: cfg({ min: 10, max: 10, healthCheck: hc(30, 5) }),
    hints: ["The failed count says when the hung instances were detected: 150 s after they hung, 30 req/s the whole time.", "Every 10 s with a threshold of 2 detects in 20 s. A threshold of 1 also removes the flaky instance each time it misses a check.", "Health checks every 10 s, unhealthy after 2 consecutive failures."],
    solution: cfg({ min: 10, max: 10, healthCheck: hc(10, 2) }),
  },
  {
    id: "as-06-metric",
    title: "The metric that does not move",
    brief: "This service waits on a slow downstream: an instance at full capacity shows only 30% CPU. Demand climbs from 40 to 300 requests per second over thirteen minutes, the fleet is saturated and failing, and the CPU target of 70% is never reached, so nothing scales. Pick the metric that measures the load and serve everyone within 17,500 instance-seconds.",
    teaches: "Scale on the metric that limits the service. CPU is right for CPU-bound work; an I/O-bound service is slow long before it is busy, so requests per instance (or queue depth, or latency) is the signal, and the target is the rate one instance handles with headroom.",
    scenario: { fleet: fleet({ cpuAtCapacity: 0.3 }), demand: [{ at: 0, rps: 40 }, { at: 200, rps: 40 }, { at: 1000, rps: 300 }, { at: 1200, rps: 300 }], seconds: 1200, faults: [], flapEveryNthCheck: null },
    requirement: { maxFailed: 0, maxSlowSeconds: 60, instanceSecondsBudget: 17500, maxScaleActions: 25 },
    start: cfg({ min: 3, max: 30, policy: target({ metric: "cpu", target: 0.7 }) }),
    hints: ["CPU peaks at 30% while requests fail: the instances are waiting, not computing.", "An instance handles 20 req/s; 12 req/s per instance leaves 40% headroom, enough for the warm-up minute on a steep ramp.", "Target tracking on requests per instance at 12, min 3, max 30."],
    solution: cfg({ min: 3, max: 30, policy: target({ metric: "requests", target: 12 }) }),
  },
];

export const AUTOSCALE_EXERCISE_BY_ID = new Map(AUTOSCALE_EXERCISES.map((e) => [e.id, e]));
