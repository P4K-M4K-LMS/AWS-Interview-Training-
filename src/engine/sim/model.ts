import type { SimActionType, SimConfig } from "../../domain/types";

/**
 * Deterministic model of the fictional fleet API platform used by the
 * monitoring dashboard, the architecture visualizer and incident missions.
 *
 * Metrics are derived from configuration plus a small seeded jitter, and the
 * queue accumulates over ticks, so effects are coherent and explainable:
 *   load = requests / (workers * 60)
 *   cache misses hit the database; the database has a capacity of ~100 qps
 *   a degraded database multiplies query cost
 *   producers push 0.3 jobs per request; each consumer drains 25 jobs/s
 */

export const DB_CAPACITY_QPS = 100;
export const WORKER_RPS = 60;
export const CONSUMER_RATE = 25;
export const PRODUCE_RATIO = 0.3;

export const BASELINE_CONFIG: SimConfig = { requestsPerSec: 120, workers: 4, cacheHitRate: 0.85, dbDegraded: false, deployInProgress: false, queueConsumers: 2 };

export interface SimState {
  config: SimConfig;
  tick: number;
  queueDepth: number;
}

export type ServiceHealth = "healthy" | "degraded" | "critical";

export interface SimMetrics {
  cpu: number;
  memory: number;
  disk: number;
  latencyP50: number;
  latencyP95: number;
  errorRate: number;
  queueDepth: number;
  requestsPerSec: number;
  load: number;
  dbQps: number;
  dbSaturation: number;
  health: ServiceHealth;
}

export type SimAction =
  | { type: "scale-workers"; workers: number }
  | { type: "set-cache-hit"; rate: number }
  | { type: "restart-db" }
  | { type: "set-consumers"; consumers: number }
  | { type: "rollback-deploy" }
  | { type: "set-traffic"; requestsPerSec: number };

export const ACTION_LABELS: Record<SimActionType, string> = {
  "scale-workers": "Scale API workers",
  "set-cache-hit": "Re-warm cache with jittered TTLs",
  "restart-db": "Fail over / restart the database",
  "set-consumers": "Restart queue consumers",
  "rollback-deploy": "Roll back the deploy",
  "set-traffic": "Shed traffic (rate limit)",
};

function jitter(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createState(config: SimConfig = BASELINE_CONFIG, queueDepth = 0): SimState {
  return { config: { ...config }, tick: 0, queueDepth };
}

export function applyAction(config: SimConfig, action: SimAction): SimConfig {
  switch (action.type) {
    case "scale-workers":
      return { ...config, workers: Math.max(1, Math.min(16, Math.round(action.workers))) };
    case "set-cache-hit":
      return { ...config, cacheHitRate: Math.max(0, Math.min(1, action.rate)) };
    case "restart-db":
      return { ...config, dbDegraded: false };
    case "set-consumers":
      return { ...config, queueConsumers: Math.max(0, Math.min(12, Math.round(action.consumers))) };
    case "rollback-deploy":
      return { ...config, deployInProgress: false };
    case "set-traffic":
      return { ...config, requestsPerSec: Math.max(10, Math.min(1000, Math.round(action.requestsPerSec))) };
  }
}

/** Advances the queue by one tick (one simulated second). */
export function step(state: SimState, config: SimConfig = state.config): SimState {
  const produced = config.requestsPerSec * PRODUCE_RATIO;
  const consumed = config.queueConsumers * CONSUMER_RATE;
  const queueDepth = Math.max(0, state.queueDepth + (produced - consumed));
  return { config: { ...config }, tick: state.tick + 1, queueDepth };
}

export function computeMetrics(state: SimState): SimMetrics {
  const c = state.config;
  const t = state.tick;
  const capacity = c.workers * WORKER_RPS;
  const load = c.requestsPerSec / capacity;
  const missRate = 1 - c.cacheHitRate;
  const dbCost = c.dbDegraded ? 4 : 1;
  const dbQps = c.requestsPerSec * missRate * dbCost;
  const dbSaturation = dbQps / DB_CAPACITY_QPS;
  const baseLatency = 18 + missRate * 400 * dbCost + Math.max(0, load - 0.7) * 400 + Math.max(0, dbSaturation - 1) * 300 + (c.deployInProgress ? 60 : 0);
  const errorRate = Math.min(0.6, Math.max(0, load - 0.95) * 1.2 + Math.max(0, dbSaturation - 1) * 0.25 + (c.dbDegraded ? 0.04 : 0) + (c.deployInProgress ? 0.01 : 0));
  const cpu = Math.min(100, 8 + load * 70 + jitter(1, t) * 4);
  const memory = Math.min(100, 30 + c.workers * 5 + (c.dbDegraded ? 10 : 0) + Math.min(20, state.queueDepth / 100) + jitter(2, t) * 3);
  const disk = 61 + jitter(3, Math.floor(t / 20)) * 2;
  const p95 = baseLatency * 2.4 + jitter(5, t) * 10;
  const queueDepth = Math.round(state.queueDepth);
  const health: ServiceHealth = errorRate > 0.2 || p95 > 1500 || queueDepth > 1500 ? "critical" : errorRate > 0.03 || p95 > 500 || queueDepth > 300 ? "degraded" : "healthy";
  return {
    cpu,
    memory,
    disk,
    latencyP50: baseLatency + jitter(6, t) * 5,
    latencyP95: p95,
    errorRate,
    queueDepth,
    requestsPerSec: c.requestsPerSec * (1 - errorRate * 0.5),
    load,
    dbQps,
    dbSaturation,
    health,
  };
}

/**
 * Coherent log lines for the current tick. Each line names the component
 * and reflects the real cause so investigation is evidence-based.
 */
export function generateLogs(state: SimState, m: SimMetrics = computeMetrics(state)): string[] {
  const c = state.config;
  const ts = new Date(Date.UTC(2026, 2, 9, 9, 0, 0) + state.tick * 1000).toISOString().slice(11, 19);
  const lines: string[] = [];
  const every = (n: number, offset = 0) => (state.tick + offset) % n === 0;
  if (every(3)) lines.push(`${ts} api-gw INFO ${Math.round(m.requestsPerSec)} req/s, p95=${Math.round(m.latencyP95)}ms, errors=${(m.errorRate * 100).toFixed(1)}%`);
  if (m.load > 0.95 && every(2)) lines.push(`${ts} api-worker-${1 + (state.tick % c.workers)} WARN request queue full (load ${(m.load * 100).toFixed(0)}% of ${c.workers} workers); returning 503`);
  if (m.load > 0.7 && m.load <= 0.95 && every(5)) lines.push(`${ts} api-worker-${1 + (state.tick % c.workers)} INFO worker busy ${(m.load * 100).toFixed(0)}%`);
  if (c.cacheHitRate < 0.6 && every(2, 1)) lines.push(`${ts} cache-01 WARN hit ratio ${(c.cacheHitRate * 100).toFixed(0)}%: ${Math.round(c.requestsPerSec * (1 - c.cacheHitRate))} misses/s falling through to db-primary`);
  if (c.cacheHitRate < 0.6 && every(7)) lines.push(`${ts} cache-01 INFO 4,120 keys expired at the same second (TTL=3600 set at deploy)`);
  if (m.dbSaturation > 1 && every(2)) lines.push(`${ts} db-primary WARN ${Math.round(m.dbQps)} qps exceeds capacity (${DB_CAPACITY_QPS}); connection pool exhausted, queries queued ${Math.round((m.dbSaturation - 1) * 300)}ms`);
  if (c.dbDegraded && every(4)) lines.push(`${ts} db-primary ERROR replica lag 42s; slow query log: SELECT * FROM positions (2.8s)`);
  if (c.deployInProgress && every(6)) lines.push(`${ts} deploy INFO rolling v2.3.1: 2/${c.workers} workers restarted, warm-up in progress`);
  if (c.queueConsumers === 0 && every(3, 2)) lines.push(`${ts} queue-01 WARN no consumers registered; depth=${m.queueDepth} and growing`);
  if (c.queueConsumers === 0 && state.tick < 3) lines.push(`${ts} queue-worker-1 ERROR Out of memory: Killed process 4471 (queue-worker) total-vm:2.1GB`, `${ts} queue-worker-2 ERROR Out of memory: Killed process 4472 (queue-worker) total-vm:2.1GB`);
  if (c.queueConsumers > 0 && m.queueDepth > 300 && every(4)) lines.push(`${ts} queue-01 INFO draining: depth=${m.queueDepth}, ${c.queueConsumers} consumers at ${c.queueConsumers * CONSUMER_RATE} jobs/s`);
  if (m.health === "healthy" && every(10)) lines.push(`${ts} health-check INFO all services healthy`);
  return lines;
}
