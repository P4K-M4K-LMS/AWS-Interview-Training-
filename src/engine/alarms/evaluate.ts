import type { ServerlessConfig, SimConfig } from "../../domain/types";
import { computeMetrics, createState, step, type SimMetrics, type SimState } from "../sim/model";

/**
 * Metric alarm builder on the simulated platform. An alarm is a named rule
 * over the simulation's own metrics ("errorRate > 0.03 for 3 of 3"): it
 * fires when at least N of the last M one-second ticks breach, and a
 * composite alarm joins conditions with "and". Runs replay a scenario
 * (an incident, a healthy baseline, a noisy-but-fine moment) tick by tick,
 * so the learner sees which alarms would have caught which incident, how
 * fast, and which would have paged for nothing. Vendor-neutral: the
 * metrics, the platform and the words are OpsForge's own.
 */
export type Op = ">" | ">=" | "<" | "<=";

export interface AlarmCondition {
  metric: string; // e.g. errorRate, latencyP95, fn.throttleRate
  op: Op;
  threshold: number;
  /** Fire when at least `n` of the last `m` ticks breach. */
  n: number;
  m: number;
}

export interface Alarm {
  name: string;
  conditions: AlarmCondition[]; // all must hold at the same tick (composite "and")
  line: number;
}

export interface ParseError {
  line: number;
  message: string;
}

/** Metrics an alarm may reference, with plain-words help. */
export const ALARM_METRICS: Record<string, { label: string; unit: string; help: string }> = {
  errorRate: { label: "error rate", unit: "share (0-1)", help: "Share of requests that fail. Customers feel this directly." },
  latencyP95: { label: "p95 latency", unit: "ms", help: "The slowest 5% of requests; the first thing to move when something saturates." },
  latencyP50: { label: "p50 latency", unit: "ms", help: "Typical request time." },
  cpu: { label: "worker CPU", unit: "%", help: "Follows load; high CPU is not an outage by itself." },
  memory: { label: "worker memory", unit: "%", help: "Grows with workers, a degraded database and queue depth." },
  load: { label: "API load", unit: "share of capacity", help: "Requests divided by what the workers can serve." },
  queueDepth: { label: "job queue depth", unit: "jobs", help: "Jobs waiting. Grows when producers outrun consumers; a burst that drains is fine." },
  dbSaturation: { label: "database saturation", unit: "share of capacity", help: "Query load divided by what the database can serve." },
  dbQps: { label: "database queries", unit: "per second", help: "Cache misses and reads pinned to the primary." },
  replicaLag: { label: "replica lag", unit: "s", help: "How far the read replica is behind. Map reads go stale past 5 s." },
  requestsPerSec: { label: "requests served", unit: "per second", help: "Served traffic; drops as errors rise." },
  "fn.throttleRate": { label: "function throttling", unit: "share (0-1)", help: "Invocations rejected by the concurrency limit." },
  "fn.coldStartShare": { label: "cold starts", unit: "share (0-1)", help: "Served invocations that paid a cold start this second." },
  "fn.duplicatesPerSec": { label: "duplicate side effects", unit: "per second", help: "Retried non-idempotent invocations repeating their work." },
  "fn.lostPerSec": { label: "lost invocations", unit: "per second", help: "Failed async invocations never retried." },
  "fn.poisonBacklog": { label: "poison backlog", unit: "messages", help: "Messages that fail every time and keep retrying." },
  "fn.dlqDepth": { label: "dead-letter depth", unit: "messages", help: "Messages parked after too many attempts." },
};

/**
 * One alarm per line:
 *   alert: errorRate > 0.03 for 3 of 3
 *   page: errorRate > 0.2 for 3 of 3 and latencyP95 > 1000 for 3 of 3
 * Blank lines and # comments are ignored.
 */
export function parseAlarms(text: string): { alarms: Alarm[]; errors: ParseError[] } {
  const alarms: Alarm[] = [];
  const errors: ParseError[] = [];
  const names = new Set<string>();
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const m = /^([A-Za-z][\w-]*)\s*:\s*(.+)$/.exec(s);
    if (!m) {
      errors.push({ line, message: 'expected "<name>: <metric> <op> <threshold> for <n> of <m> [and ...]"' });
      return;
    }
    const [, name, rest] = m;
    if (names.has(name)) {
      errors.push({ line, message: `alarm "${name}" is defined twice` });
      return;
    }
    const conditions: AlarmCondition[] = [];
    for (const part of rest.split(/\s+and\s+/i)) {
      const c = /^([A-Za-z][\w.]*)\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s+for\s+(\d+)\s+of\s+(\d+)$/i.exec(part.trim());
      if (!c) {
        errors.push({ line, message: `cannot read "${part.trim()}"; use <metric> <op> <threshold> for <n> of <m>` });
        return;
      }
      const [, metric, op, threshold, n, mm] = c;
      if (!ALARM_METRICS[metric]) {
        errors.push({ line, message: `unknown metric ${metric}; known: ${Object.keys(ALARM_METRICS).join(", ")}` });
        return;
      }
      const nn = Number(n);
      const mN = Number(mm);
      if (nn < 1 || mN < 1 || nn > mN || mN > 120) {
        errors.push({ line, message: `"for ${n} of ${mm}" must satisfy 1 <= n <= m <= 120` });
        return;
      }
      conditions.push({ metric, op: op as Op, threshold: Number(threshold), n: nn, m: mN });
    }
    names.add(name);
    alarms.push({ name, conditions, line });
  });
  return { alarms, errors };
}

/* ---------------- runs ---------------- */

export interface RunChange {
  atTick: number;
  patch: Partial<Omit<SimConfig, "serverless">> & { serverless?: Partial<ServerlessConfig> };
}

export interface Run {
  id: string;
  label: string;
  kind: "incident" | "healthy" | "noise";
  config: SimConfig;
  queueDepth?: number;
  replicaLag?: number;
  serverless?: Parameters<typeof createState>[3];
  changes?: RunChange[];
  ticks: number;
  /** Expectation per alarm name: fire within `deadline` ticks, or stay quiet. */
  expect: Record<string, "fire" | "quiet">;
  deadline?: number;
  /** Why this run is in the exercise, shown to the learner. */
  why: string;
}

export function metricValue(m: SimMetrics, path: string): number | undefined {
  if (path.startsWith("fn.")) {
    const v = m.fn?.[path.slice(3) as keyof NonNullable<SimMetrics["fn"]>];
    return typeof v === "number" ? v : undefined;
  }
  const v = m[path as keyof SimMetrics];
  return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : undefined;
}

/** Replays a run tick by tick and returns the metrics per tick. */
export function replay(run: Run): SimMetrics[] {
  let state: SimState = createState(run.config, run.queueDepth ?? 0, run.replicaLag ?? 0, run.serverless ?? {});
  const out: SimMetrics[] = [];
  for (let t = 0; t < run.ticks; t++) {
    const change = run.changes?.find((c) => c.atTick === t);
    if (change) {
      const { serverless, ...rest } = change.patch;
      const config: SimConfig = { ...state.config, ...rest, ...(serverless && state.config.serverless ? { serverless: { ...state.config.serverless, ...serverless } } : {}) };
      state = { ...state, config };
    }
    out.push(computeMetrics(state));
    state = step(state);
  }
  return out;
}

function breaches(c: AlarmCondition, value: number | undefined): boolean {
  if (value === undefined) return false;
  switch (c.op) {
    case ">":
      return value > c.threshold;
    case ">=":
      return value >= c.threshold;
    case "<":
      return value < c.threshold;
    case "<=":
      return value <= c.threshold;
  }
}

export interface AlarmRunResult {
  alarm: string;
  /** First tick (0-based) at which the alarm was in ALARM state, or null if never. */
  firedAt: number | null;
  /** Ticks in ALARM state. */
  alarmTicks: number;
}

/** Evaluates every alarm over a run's metrics. */
export function evaluateRun(alarms: Alarm[], series: SimMetrics[]): AlarmRunResult[] {
  return alarms.map((a) => {
    let firedAt: number | null = null;
    let alarmTicks = 0;
    for (let t = 0; t < series.length; t++) {
      const inAlarm = a.conditions.every((c) => {
        if (t < c.m - 1) return false;
        let count = 0;
        for (let k = t - c.m + 1; k <= t; k++) if (breaches(c, metricValue(series[k], c.metric))) count++;
        return count >= c.n;
      });
      if (inAlarm) {
        alarmTicks++;
        if (firedAt === null) firedAt = t;
      }
    }
    return { alarm: a.name, firedAt, alarmTicks };
  });
}

export interface RunVerdict {
  run: Run;
  series: SimMetrics[];
  results: AlarmRunResult[];
  checks: Array<{ alarm: string; want: "fire" | "quiet"; passed: boolean; detail: string }>;
  ok: boolean;
}

export function evaluateExercise(alarms: Alarm[], runs: Run[]): RunVerdict[] {
  return runs.map((run) => {
    const series = replay(run);
    const results = evaluateRun(alarms, series);
    const deadline = run.deadline ?? 30;
    const checks = Object.entries(run.expect).map(([name, want]) => {
      const r = results.find((x) => x.alarm === name);
      if (!r) return { alarm: name, want, passed: false, detail: `define an alarm named "${name}"` };
      if (want === "fire") {
        const passed = r.firedAt !== null && r.firedAt < deadline;
        return { alarm: name, want, passed, detail: r.firedAt === null ? `"${name}" never fired in ${run.ticks} s` : r.firedAt < deadline ? `"${name}" fired at ${r.firedAt + 1} s` : `"${name}" fired at ${r.firedAt + 1} s, after the ${deadline} s deadline` };
      }
      const passed = r.firedAt === null;
      return { alarm: name, want, passed, detail: passed ? `"${name}" stayed quiet` : `"${name}" fired at ${r.firedAt! + 1} s for ${r.alarmTicks} s: a false alarm` };
    });
    return { run, series, results, checks, ok: checks.every((c) => c.passed) };
  });
}
