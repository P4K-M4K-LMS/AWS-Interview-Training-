import type { CheckResult } from "../../domain/types";

/**
 * A fleet behind a load balancer, scaled by a policy, simulated second by
 * second. Demand is a curve of requests per second; each instance serves a
 * fixed rate once it has finished warming up; a load balancer spreads
 * requests over every instance it believes is in service, including ones
 * that have hung but not yet failed enough health checks. The policy adds or
 * removes instances from a metric (cpu, which an I/O-bound workload barely
 * moves, or requests per instance), with or without counting the instances
 * still warming up, with evaluation periods and cooldowns; a schedule can
 * raise the minimum ahead of a known surge. The outcome counts what the
 * configuration costs: failed requests, slow seconds, instance-seconds,
 * scaling actions and healthy instances thrown away by health checks.
 * Vendor-neutral; the numbers are the platform's own.
 */
export interface Fleet {
  perInstanceRps: number;
  warmupSeconds: number;
  /** CPU fraction an instance shows at full capacity: 1 for CPU-bound work, 0.3 for I/O-bound work that is slow long before it is busy. */
  cpuAtCapacity: number;
}

export interface Scenario {
  fleet: Fleet;
  /** Demand in requests per second, linearly interpolated between points. */
  demand: Array<{ at: number; rps: number }>;
  seconds: number;
  /** Instances that hang (serve nothing, fail every health check) from a given second. */
  faults: Array<{ at: number; instances: number }>;
  /** One instance fails every Nth health check once, then passes again; null for none. */
  flapEveryNthCheck: number | null;
}

export type Metric = "cpu" | "requests";

export type Policy =
  | { kind: "none" }
  | { kind: "target"; metric: Metric; target: number; countWarming: boolean; scaleInCooldownSeconds: number }
  | { kind: "step"; metric: Metric; up: { above: number; add: number }; down: { below: number; remove: number }; evaluationSeconds: number; cooldownSeconds: number };

export interface Config {
  min: number;
  max: number;
  policy: Policy;
  schedule: Array<{ at: number; minimum: number }>;
  healthCheck: { intervalSeconds: number; unhealthyThreshold: number };
}

export interface Requirement {
  maxFailed: number;
  maxSlowSeconds: number;
  instanceSecondsBudget: number;
  maxScaleActions: number;
}

export interface Outcome {
  failedRequests: number;
  slowSeconds: number;
  instanceSeconds: number;
  scaleActions: number;
  healthyRemoved: number;
  hungDetectedAfter: number | null;
  peakInstances: number;
  ticks: Array<{ t: number; demand: number; serving: number; warming: number; capacity: number; failed: number }>;
}

interface Instance {
  id: number;
  readyAt: number;
  hung: boolean;
  failedChecks: number;
}

/** Policies look at the metric once every evaluation period, not every second. */
export const EVALUATION_SECONDS = 10;

export function demandAt(points: Array<{ at: number; rps: number }>, t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0].at) return points[0].rps;
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i].at) {
      const a = points[i - 1];
      const b = points[i];
      const f = b.at === a.at ? 1 : (t - a.at) / (b.at - a.at);
      return a.rps + (b.rps - a.rps) * f;
    }
  }
  return points[points.length - 1].rps;
}

export function simulate(scenario: Scenario, config: Config): Outcome {
  const { fleet } = scenario;
  const out: Outcome = { failedRequests: 0, slowSeconds: 0, instanceSeconds: 0, scaleActions: 0, healthyRemoved: 0, hungDetectedAfter: null, peakInstances: 0, ticks: [] };
  let nextId = 1;
  const instances: Instance[] = [];
  const launch = (t: number, n: number, warm = true) => {
    for (let i = 0; i < n; i++) instances.push({ id: nextId++, readyAt: warm ? t + fleet.warmupSeconds : t, hung: false, failedChecks: 0 });
  };
  launch(0, config.min, false);
  let minimum = config.min;
  let lastAction = -Infinity;
  let breachUp = 0;
  let breachDown = 0;
  let checks = 0;
  let hungAt: number | null = null;
  const faults = [...scenario.faults].sort((a, b) => a.at - b.at);

  const metricValue = (metric: Metric, demand: number, counted: number): number => {
    if (counted <= 0) return Infinity;
    const perInstance = demand / counted;
    return metric === "requests" ? perInstance : Math.min(1, perInstance / fleet.perInstanceRps) * fleet.cpuAtCapacity;
  };

  for (let t = 0; t < scenario.seconds; t++) {
    // Scheduled minimum changes.
    for (const s of config.schedule) if (s.at === t) minimum = Math.min(config.max, Math.max(0, s.minimum));
    // Faults: the oldest healthy serving instances hang.
    while (faults.length && faults[0].at === t) {
      const f = faults.shift()!;
      const victims = instances.filter((i) => i.readyAt <= t && !i.hung).slice(0, f.instances);
      for (const v of victims) v.hung = true;
      if (victims.length && hungAt === null) hungAt = t;
    }
    // Health checks every interval on instances in service.
    if (config.healthCheck.intervalSeconds > 0 && t % config.healthCheck.intervalSeconds === 0 && t > 0) {
      checks += 1;
      for (let i = instances.length - 1; i >= 0; i--) {
        const inst = instances[i];
        if (inst.readyAt > t) continue;
        const flap = scenario.flapEveryNthCheck !== null && inst.id === 1 && checks % scenario.flapEveryNthCheck === 0;
        if (inst.hung || flap) inst.failedChecks += 1;
        else inst.failedChecks = 0;
        if (inst.failedChecks >= config.healthCheck.unhealthyThreshold) {
          if (!inst.hung) out.healthyRemoved += 1;
          else if (out.hungDetectedAfter === null && hungAt !== null) out.hungDetectedAfter = t - hungAt;
          instances.splice(i, 1);
          launch(t, 1);
        }
      }
    }
    const demand = demandAt(scenario.demand, t);
    const serving = instances.filter((i) => i.readyAt <= t);
    const warming = instances.length - serving.length;
    const healthy = serving.filter((i) => !i.hung).length;
    const hung = serving.length - healthy;
    // Traffic: the balancer spreads over everything it believes is in service.
    const toHung = serving.length ? demand * (hung / serving.length) : 0;
    const toHealthy = demand - toHung;
    const capacity = healthy * fleet.perInstanceRps;
    const overflow = serving.length === 0 ? demand : Math.max(0, toHealthy - capacity);
    const failed = toHung + overflow;
    out.failedRequests += failed;
    const util = capacity > 0 ? toHealthy / capacity : Infinity;
    if (util > 0.85 && demand > 0) out.slowSeconds += 1;
    out.instanceSeconds += instances.length;
    out.peakInstances = Math.max(out.peakInstances, instances.length);
    out.ticks.push({ t, demand: Math.round(demand), serving: serving.length, warming, capacity, failed: Math.round(failed) });

    // Scaling.
    const p = config.policy;
    const total = instances.length;
    let desired = total;
    const evaluating = t % EVALUATION_SECONDS === 0;
    if (p.kind === "target" && evaluating) {
      const counted = p.countWarming ? healthy + warming : healthy;
      const m = metricValue(p.metric, demand, counted);
      const want = counted <= 0 ? 1 : Math.ceil((counted * m) / p.target);
      // Without counting warming instances, the policy launches again for the same shortfall at every evaluation.
      if (want > (p.countWarming ? total : healthy)) desired = p.countWarming ? want : total + (want - healthy);
      else if (want < total && t - lastAction >= p.scaleInCooldownSeconds) desired = want;
    } else if (p.kind === "step") {
      const m = metricValue(p.metric, demand, healthy);
      breachUp = m > p.up.above ? breachUp + 1 : 0;
      breachDown = m < p.down.below ? breachDown + 1 : 0;
      if (evaluating && t - lastAction >= p.cooldownSeconds) {
        if (breachUp >= p.evaluationSeconds) {
          desired = total + p.up.add;
          breachUp = 0;
        } else if (breachDown >= p.evaluationSeconds) {
          desired = total - p.down.remove;
          breachDown = 0;
        }
      }
    }
    desired = Math.min(config.max, Math.max(minimum, desired));
    if (desired > total) {
      launch(t, desired - total);
      out.scaleActions += 1;
      lastAction = t;
    } else if (desired < total) {
      // Terminate the newest instances first (warming ones before serving ones).
      instances.sort((a, b) => a.readyAt - b.readyAt);
      instances.splice(desired);
      out.scaleActions += 1;
      lastAction = t;
    }
  }
  out.failedRequests = Math.round(out.failedRequests);
  return out;
}

export function checkScaling(scenario: Scenario, config: Config, req: Requirement): { outcome: Outcome; checks: CheckResult[] } {
  const o = simulate(scenario, config);
  const checks: CheckResult[] = [
    { id: "failed", label: `At most ${req.maxFailed.toLocaleString()} failed requests`, passed: o.failedRequests <= req.maxFailed, detail: `${o.failedRequests.toLocaleString()} failed${o.hungDetectedAfter !== null ? `; hung instances detected after ${o.hungDetectedAfter} s` : ""}` },
    { id: "slow", label: `At most ${req.maxSlowSeconds} slow seconds (fleet above 85% busy)`, passed: o.slowSeconds <= req.maxSlowSeconds, detail: `${o.slowSeconds} slow seconds` },
    { id: "cost", label: `At most ${req.instanceSecondsBudget.toLocaleString()} instance-seconds`, passed: o.instanceSeconds <= req.instanceSecondsBudget, detail: `${o.instanceSeconds.toLocaleString()} instance-seconds, peak ${o.peakInstances} instances` },
    { id: "actions", label: `At most ${req.maxScaleActions} scaling actions`, passed: o.scaleActions <= req.maxScaleActions, detail: `${o.scaleActions} actions` },
    { id: "churn", label: "No healthy instance thrown away by health checks", passed: o.healthyRemoved === 0, detail: o.healthyRemoved ? `${o.healthyRemoved} healthy instance${o.healthyRemoved === 1 ? "" : "s"} removed` : "none removed" },
  ];
  return { outcome: o, checks };
}

export function describeConfig(c: Config): string {
  const p = c.policy;
  const policy =
    p.kind === "none"
      ? "no scaling policy"
      : p.kind === "target"
        ? `target tracking at ${p.metric === "cpu" ? `${Math.round(p.target * 100)}% CPU` : `${p.target} requests/s per instance`}${p.countWarming ? ", warming instances counted" : ", warming instances ignored"}, scale-in cooldown ${p.scaleInCooldownSeconds} s`
        : `step scaling on ${p.metric} (+${p.up.add} above ${p.up.above}, −${p.down.remove} below ${p.down.below}, ${p.evaluationSeconds} s evaluation, ${p.cooldownSeconds} s cooldown)`;
  const sched = c.schedule.length ? `; scheduled minimum ${c.schedule.map((s) => `${s.minimum} at ${s.at} s`).join(", ")}` : "";
  return `${c.min}–${c.max} instances, ${policy}${sched}; health checks every ${c.healthCheck.intervalSeconds} s, unhealthy after ${c.healthCheck.unhealthyThreshold}`;
}
