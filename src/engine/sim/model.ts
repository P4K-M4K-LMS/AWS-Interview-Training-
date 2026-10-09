import type { ServerlessConfig, SimActionType, SimConfig, SimSnapshot } from "../../domain/types";

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
 *   the dispatcher map reads (0.4 per request) bypass the cache and are served
 *   by a read replica; the replica replays ~3 s of writes per second when
 *   healthy, so lag shrinks by 2 s/s, and grows 1 s/s while its apply thread
 *   is blocked. Map reads older than 5 s are stale.
 *   optional serverless part: a synchronous function serves the API at
 *   capacity = reservedConcurrency / duration; invocations above it are
 *   throttled. Execution environments warm up WARMUP_PER_TICK per second,
 *   provisioned ones start warm; a cold start adds COLD_START_MS. The async
 *   function drains the job queue: poison messages retry every second until a
 *   dead-letter queue takes them after maxReceiveCount attempts; timed-out
 *   invocations are retried asyncRetries times and, without an idempotent
 *   handler, repeat their side effects.
 */

export const DB_CAPACITY_QPS = 100;
export const WORKER_RPS = 60;
export const CONSUMER_RATE = 25;
export const PRODUCE_RATIO = 0.3;
export const WRITE_RATIO = 0.1;
export const MAP_READ_RATIO = 0.4;
export const REPLICA_CATCHUP = 3;
export const STALE_READ_SEC = 5;
export const WARMUP_PER_TICK = 2;
export const COLD_START_MS = 800;

export const BASELINE_CONFIG: SimConfig = { requestsPerSec: 120, workers: 4, cacheHitRate: 0.85, dbDegraded: false, deployInProgress: false, queueConsumers: 2, replicaBlocked: false, readsFromPrimary: false };

export interface SimState {
  config: SimConfig;
  tick: number;
  queueDepth: number;
  /** Seconds the read replica is behind the primary. */
  replicaLag: number;
  /** Seconds of writes discarded by promoting a lagging replica; 0 when none. */
  lostWritesSec: number;
  /** Warm execution environments of the synchronous function. */
  warmEnvironments: number;
  /** Queue messages that keep failing and are retried every second. */
  poisonBacklog: number;
  dlqDepth: number;
  /** Side effects repeated by retried non-idempotent invocations (cumulative). */
  duplicateSideEffects: number;
  /** Failed async invocations that were never retried (cumulative). */
  lostInvocations: number;
}

/** Derived numbers for the serverless part, present only when configured. */
export interface FunctionMetrics {
  invocationsPerSec: number;
  /** Concurrency the traffic needs: rate × duration. */
  neededConcurrency: number;
  reservedConcurrency: number;
  warmEnvironments: number;
  /** Share of invocations rejected by the concurrency limit. */
  throttleRate: number;
  /** Share of served invocations that paid a cold start this second. */
  coldStartShare: number;
  p95: number;
  poisonBacklog: number;
  dlqDepth: number;
  /** Duplicate side effects produced this second. */
  duplicatesPerSec: number;
  duplicateSideEffects: number;
  lostPerSec: number;
  lostInvocations: number;
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
  replicaLag: number;
  /** Map reads are being served from a replica more than STALE_READ_SEC behind. */
  staleReads: boolean;
  fn?: FunctionMetrics;
  health: ServiceHealth;
}

export type SimAction =
  | { type: "scale-workers"; workers: number }
  | { type: "set-cache-hit"; rate: number }
  | { type: "restart-db" }
  | { type: "set-consumers"; consumers: number }
  | { type: "rollback-deploy" }
  | { type: "set-traffic"; requestsPerSec: number }
  | { type: "kill-blocking-query" }
  | { type: "route-reads-primary" }
  | { type: "route-reads-replica" }
  | { type: "set-reserved-concurrency"; concurrency: number }
  | { type: "set-provisioned-concurrency"; concurrency: number }
  | { type: "enable-dlq"; maxReceiveCount: number }
  | { type: "set-async-retries"; retries: number }
  | { type: "make-handler-idempotent" }
  | { type: "raise-function-timeout" };

export const ACTION_LABELS: Record<SimActionType, string> = {
  "scale-workers": "Scale API workers",
  "set-cache-hit": "Re-warm cache with jittered TTLs",
  "restart-db": "Fail over / restart the database",
  "set-consumers": "Restart queue consumers",
  "rollback-deploy": "Roll back the deploy",
  "set-traffic": "Shed traffic (rate limit)",
  "kill-blocking-query": "Kill the statement blocking replication",
  "route-reads-primary": "Pin map reads to the primary",
  "route-reads-replica": "Route map reads back to the replica",
  "set-reserved-concurrency": "Set the function's concurrency limit",
  "set-provisioned-concurrency": "Set provisioned (pre-warmed) concurrency",
  "enable-dlq": "Enable a dead-letter queue (max receive count)",
  "set-async-retries": "Set platform retries for async invocations",
  "make-handler-idempotent": "Deploy the idempotent handler (idempotency keys)",
  "raise-function-timeout": "Raise the function timeout and downstream timeout budget",
};

function fmtDuration(sec: number) {
  return `00:${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function jitter(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createState(config: SimConfig = BASELINE_CONFIG, queueDepth = 0, replicaLag = 0, serverless: Partial<Pick<SimState, "warmEnvironments" | "poisonBacklog" | "dlqDepth" | "duplicateSideEffects" | "lostInvocations">> = {}): SimState {
  return {
    config: { ...config },
    tick: 0,
    queueDepth,
    replicaLag,
    lostWritesSec: 0,
    warmEnvironments: serverless.warmEnvironments ?? config.serverless?.provisionedConcurrency ?? 0,
    poisonBacklog: serverless.poisonBacklog ?? 0,
    dlqDepth: serverless.dlqDepth ?? 0,
    duplicateSideEffects: serverless.duplicateSideEffects ?? 0,
    lostInvocations: serverless.lostInvocations ?? 0,
  };
}

export function snapshot(state: SimState): SimSnapshot {
  return {
    queueDepth: state.queueDepth,
    replicaLag: state.replicaLag,
    lostWritesSec: state.lostWritesSec,
    warmEnvironments: state.warmEnvironments,
    poisonBacklog: state.poisonBacklog,
    dlqDepth: state.dlqDepth,
    duplicateSideEffects: state.duplicateSideEffects,
    lostInvocations: state.lostInvocations,
  };
}

function sl(config: SimConfig, patch: Partial<ServerlessConfig>): SimConfig {
  return config.serverless ? { ...config, serverless: { ...config.serverless, ...patch } } : config;
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
    case "kill-blocking-query":
      return { ...config, replicaBlocked: false };
    case "route-reads-primary":
      return { ...config, readsFromPrimary: true };
    case "route-reads-replica":
      return { ...config, readsFromPrimary: false };
    case "set-reserved-concurrency":
      return sl(config, { reservedConcurrency: Math.max(1, Math.min(1000, Math.round(action.concurrency))) });
    case "set-provisioned-concurrency":
      return sl(config, { provisionedConcurrency: Math.max(0, Math.min(1000, Math.round(action.concurrency))) });
    case "enable-dlq":
      return sl(config, { dlqEnabled: true, maxReceiveCount: Math.max(1, Math.min(20, Math.round(action.maxReceiveCount))) });
    case "set-async-retries":
      return sl(config, { asyncRetries: Math.max(0, Math.min(5, Math.round(action.retries))) });
    case "make-handler-idempotent":
      return sl(config, { handlerIdempotent: true });
    case "raise-function-timeout":
      return sl(config, { timeoutRate: 0.01 });
  }
}

/**
 * Promotes the standby to primary. A standby that is behind has not received
 * the writes committed in its lag window: promoting it discards them. This is
 * the state-level effect of the "restart-db" (fail over) action.
 */
export function failover(state: SimState): SimState {
  const lost = state.replicaLag > STALE_READ_SEC ? Math.round(state.replicaLag) : 0;
  return { ...state, config: { ...state.config, dbDegraded: false, replicaBlocked: false }, replicaLag: 0, lostWritesSec: state.lostWritesSec || lost };
}

/** Advances the queue by one tick (one simulated second). */
export function step(state: SimState, config: SimConfig = state.config): SimState {
  const produced = config.requestsPerSec * PRODUCE_RATIO;
  const consumed = config.queueConsumers * CONSUMER_RATE;
  const queueDepth = Math.max(0, state.queueDepth + (produced - consumed));
  // The replica falls behind one second per second while blocked and gains
  // (REPLICA_CATCHUP - 1) seconds per second once it can apply again.
  const replicaLag = Math.max(0, state.replicaLag + (config.replicaBlocked ? 1 : -(REPLICA_CATCHUP - 1)));
  const s = config.serverless;
  if (!s) return { ...state, config: { ...config }, tick: state.tick + 1, queueDepth, replicaLag };
  // Poison messages retry every second and each retry costs one processing slot.
  const poisonIn = produced * s.poisonRate;
  const toDlq = s.dlqEnabled ? state.poisonBacklog / s.maxReceiveCount : 0;
  const poisonBacklog = Math.max(0, state.poisonBacklog + poisonIn - toDlq);
  const dlqDepth = state.dlqDepth + toDlq;
  const retryLoad = Math.min(consumed, state.poisonBacklog);
  const slQueueDepth = Math.max(0, state.queueDepth + (produced - (consumed - retryLoad)));
  // Warm environments grow toward what the traffic needs; provisioned ones never go cold.
  const needed = (config.requestsPerSec * s.durationMs) / 1000;
  const target = Math.min(needed, s.reservedConcurrency);
  const warmEnvironments = Math.max(s.provisionedConcurrency, Math.min(target, state.warmEnvironments + WARMUP_PER_TICK));
  // Timed-out async invocations: retried (duplicating side effects unless idempotent) or lost.
  const timedOut = produced * s.timeoutRate;
  const duplicates = s.asyncRetries > 0 && !s.handlerIdempotent ? timedOut : 0;
  const lost = s.asyncRetries === 0 ? timedOut : 0;
  return {
    config: { ...config },
    tick: state.tick + 1,
    queueDepth: slQueueDepth,
    replicaLag,
    lostWritesSec: state.lostWritesSec,
    warmEnvironments,
    poisonBacklog,
    dlqDepth,
    duplicateSideEffects: state.duplicateSideEffects + duplicates,
    lostInvocations: state.lostInvocations + lost,
  };
}

function functionMetrics(state: SimState): FunctionMetrics | undefined {
  const c = state.config;
  const s = c.serverless;
  if (!s) return undefined;
  const invocationsPerSec = c.requestsPerSec;
  const neededConcurrency = (invocationsPerSec * s.durationMs) / 1000;
  const capacityRps = (s.reservedConcurrency * 1000) / s.durationMs;
  const throttleRate = Math.max(0, 1 - capacityRps / invocationsPerSec);
  const served = Math.min(neededConcurrency, s.reservedConcurrency);
  const coldStartShare = served > 0 ? Math.max(0, served - state.warmEnvironments) / served : 0;
  const p95 = s.durationMs * 1.6 + coldStartShare * COLD_START_MS + (throttleRate > 0 ? 40 : 0);
  const produced = c.requestsPerSec * PRODUCE_RATIO;
  const timedOut = produced * s.timeoutRate;
  return {
    invocationsPerSec,
    neededConcurrency,
    reservedConcurrency: s.reservedConcurrency,
    warmEnvironments: state.warmEnvironments,
    throttleRate,
    coldStartShare,
    p95,
    poisonBacklog: state.poisonBacklog,
    dlqDepth: Math.round(state.dlqDepth),
    duplicatesPerSec: s.asyncRetries > 0 && !s.handlerIdempotent ? timedOut : 0,
    duplicateSideEffects: Math.round(state.duplicateSideEffects),
    lostPerSec: s.asyncRetries === 0 ? timedOut : 0,
    lostInvocations: Math.round(state.lostInvocations),
  };
}

export function computeMetrics(state: SimState): SimMetrics {
  const c = state.config;
  const t = state.tick;
  const capacity = c.workers * WORKER_RPS;
  const load = c.requestsPerSec / capacity;
  const missRate = 1 - c.cacheHitRate;
  const dbCost = c.dbDegraded ? 4 : 1;
  const mapReadsOnPrimary = c.readsFromPrimary ? c.requestsPerSec * MAP_READ_RATIO : 0;
  const dbQps = (c.requestsPerSec * missRate + mapReadsOnPrimary) * dbCost;
  const dbSaturation = dbQps / DB_CAPACITY_QPS;
  const staleReads = !c.readsFromPrimary && state.replicaLag > STALE_READ_SEC;
  const fn = functionMetrics(state);
  const baseLatency = 18 + missRate * 400 * dbCost + Math.max(0, load - 0.7) * 400 + Math.max(0, dbSaturation - 1) * 300 + (c.deployInProgress ? 60 : 0) + (fn ? fn.p95 / 2.4 : 0);
  const errorRate = Math.min(0.6, Math.max(0, load - 0.95) * 1.2 + Math.max(0, dbSaturation - 1) * 0.25 + (c.dbDegraded ? 0.04 : 0) + (c.deployInProgress ? 0.01 : 0) + (fn ? fn.throttleRate : 0));
  const cpu = Math.min(100, 8 + load * 70 + jitter(1, t) * 4);
  const memory = Math.min(100, 30 + c.workers * 5 + (c.dbDegraded ? 10 : 0) + Math.min(20, state.queueDepth / 100) + jitter(2, t) * 3);
  const disk = 61 + jitter(3, Math.floor(t / 20)) * 2;
  const p95 = baseLatency * 2.4 + jitter(5, t) * 10;
  const queueDepth = Math.round(state.queueDepth);
  const fnDegraded = Boolean(fn && (fn.duplicatesPerSec > 0 || fn.lostPerSec > 0 || fn.coldStartShare > 0.2));
  const health: ServiceHealth =
    errorRate > 0.2 || p95 > 1500 || queueDepth > 1500 || (staleReads && state.replicaLag > 180) ? "critical" : errorRate > 0.03 || p95 > 500 || queueDepth > 300 || staleReads || fnDegraded ? "degraded" : "healthy";
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
    replicaLag: Math.round(state.replicaLag),
    staleReads,
    fn,
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
  if (m.replicaLag > STALE_READ_SEC && every(3, 1)) lines.push(`${ts} db-replica WARN replication lag ${m.replicaLag}s${c.replicaBlocked ? " and rising" : ", catching up"}`);
  if (c.replicaBlocked && every(6, 2)) lines.push(`${ts} db-replica WARN apply thread waiting for lock on positions; held by pid 8812 (analytics-report: SELECT vehicle_id, max(ts) FROM positions GROUP BY vehicle_id, running ${fmtDuration(240 + state.tick)})`);
  if (c.replicaBlocked && every(9, 4)) lines.push(`${ts} db-primary INFO ${Math.round(c.requestsPerSec * WRITE_RATIO)} writes/s committed; replication stream sending normally`);
  if (m.staleReads && every(4, 2)) lines.push(`${ts} api-worker-${1 + (state.tick % c.workers)} INFO GET /positions served from db-replica (data age ${m.replicaLag}s)`);
  if (c.readsFromPrimary && every(5, 3)) lines.push(`${ts} api-worker-${1 + (state.tick % c.workers)} INFO map reads pinned to db-primary (+${Math.round(c.requestsPerSec * MAP_READ_RATIO)} qps)`);
  if (state.lostWritesSec > 0 && every(4, 1)) lines.push(`${ts} db-primary ERROR promoted standby was ${state.lostWritesSec}s behind: writes committed in that window are missing (data loss)`);
  if (c.deployInProgress && every(6)) lines.push(`${ts} deploy INFO rolling v2.3.1: 2/${c.workers} workers restarted, warm-up in progress`);
  if (c.queueConsumers === 0 && every(3, 2)) lines.push(`${ts} queue-01 WARN no consumers registered; depth=${m.queueDepth} and growing`);
  if (c.queueConsumers === 0 && state.tick < 3) lines.push(`${ts} queue-worker-1 ERROR Out of memory: Killed process 4471 (queue-worker) total-vm:2.1GB`, `${ts} queue-worker-2 ERROR Out of memory: Killed process 4472 (queue-worker) total-vm:2.1GB`);
  if (c.queueConsumers > 0 && m.queueDepth > 300 && every(4)) lines.push(`${ts} queue-01 INFO draining: depth=${m.queueDepth}, ${c.queueConsumers} consumers at ${c.queueConsumers * CONSUMER_RATE} jobs/s`);
  const s = c.serverless;
  if (s && m.fn) {
    const f = m.fn;
    if (f.throttleRate > 0.03 && every(2)) lines.push(`${ts} fn-positions WARN ${Math.round(f.invocationsPerSec * f.throttleRate)} invocations/s throttled: concurrency ${s.reservedConcurrency}/${s.reservedConcurrency} in use (Rate exceeded), needed ${Math.ceil(f.neededConcurrency)}`);
    if (f.coldStartShare > 0.05 && every(3, 1)) lines.push(`${ts} fn-positions INFO cold start: init ${COLD_START_MS - 20 + Math.round(jitter(9, state.tick) * 40)}ms, env #${Math.round(state.warmEnvironments) + 1} (${Math.round(f.coldStartShare * 100)}% of invocations cold this second)`);
    if (s.poisonRate > 0 && state.poisonBacklog > 5 && every(2, 1)) lines.push(`${ts} fn-billing ERROR message ${(0x8f3a + (state.tick % 7)).toString(16)}: KeyError 'vehicle_id' in payload (receive count ${Math.round(14 + state.poisonBacklog)}${s.dlqEnabled ? `, max ${s.maxReceiveCount}` : ", no dead-letter queue"})`);
    if (s.dlqEnabled && state.dlqDepth > 0 && every(5)) lines.push(`${ts} queue-01 INFO message moved to billing-dlq after ${s.maxReceiveCount} attempts; dlq depth=${Math.round(state.dlqDepth)}`);
    if (!s.dlqEnabled && state.poisonBacklog > 5 && every(6, 3)) lines.push(`${ts} queue-01 WARN ${Math.round(state.poisonBacklog)} messages have exceeded 10 receives; retrying every visibility timeout`);
    if (f.duplicatesPerSec > 0 && every(3, 2)) lines.push(`${ts} fn-invoice WARN retry of invocation ${(0x7c1d + state.tick).toString(16)} after timeout; charge for invoice INV-${5500 + state.tick} recorded twice`);
    if (f.lostPerSec > 0 && every(3, 2)) lines.push(`${ts} fn-invoice ERROR invocation ${(0x7c1d + state.tick).toString(16)} timed out; retries=0, event dropped (invoice INV-${5500 + state.tick} never sent)`);
    if (s.timeoutRate > 0.05 && every(4)) lines.push(`${ts} fn-invoice WARN Task timed out after 3.00 seconds (payment-provider call took 2.9s)`);
  }
  if (m.health === "healthy" && every(10)) lines.push(`${ts} health-check INFO all services healthy`);
  return lines;
}
