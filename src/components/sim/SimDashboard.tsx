import type { SimConfig } from "../../domain/types";
import { STALE_READ_SEC, type SimMetrics } from "../../engine/sim/model";

export function Stat({ label, value, tone = "ok", testId }: { label: string; value: string; tone?: "ok" | "warn" | "bad"; testId?: string }) {
  const color = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-red-400";
  return (
    <div className="panel p-3" data-testid={testId}>
      <div className="label">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

export function Sparkline({ data, max, color, label }: { data: number[]; max: number; color: string; label: string }) {
  const w = 600;
  const h = 60;
  const n = Math.max(2, data.length);
  const pts = data.map((v, i) => `${(i / (n - 1)) * w},${h - Math.min(1, v / max) * h}`).join(" ");
  return (
    <div>
      <div className="text-xs muted">{label}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" role="img" aria-label={`${label}, latest ${data[data.length - 1]?.toFixed(0) ?? "n/a"}`}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
      </svg>
    </div>
  );
}

export function MetricsGrid({ m, config }: { m: SimMetrics; config: SimConfig }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="metrics-grid">
      <Stat label="Service health" value={m.health} tone={m.health === "healthy" ? "ok" : m.health === "degraded" ? "warn" : "bad"} testId="stat-health" />
      <Stat label="Requests / s (served)" value={m.requestsPerSec.toFixed(0)} />
      <Stat label="Error rate" value={`${(m.errorRate * 100).toFixed(1)}%`} tone={m.errorRate > 0.03 ? (m.errorRate > 0.2 ? "bad" : "warn") : "ok"} />
      <Stat label="Latency p50 / p95" value={`${m.latencyP50.toFixed(0)} / ${m.latencyP95.toFixed(0)} ms`} tone={m.latencyP95 > 500 ? (m.latencyP95 > 1500 ? "bad" : "warn") : "ok"} />
      <Stat label="API load (req ÷ capacity)" value={`${(m.load * 100).toFixed(0)}%`} tone={m.load > 0.95 ? "bad" : m.load > 0.7 ? "warn" : "ok"} />
      <Stat label="DB queries / s (cap 100)" value={`${m.dbQps.toFixed(0)}`} tone={m.dbSaturation > 1 ? "bad" : m.dbSaturation > 0.7 ? "warn" : "ok"} />
      <Stat label="Queue depth" value={String(m.queueDepth)} tone={m.queueDepth > 1500 ? "bad" : m.queueDepth > 300 ? "warn" : "ok"} testId="stat-queue" />
      <Stat label="CPU / memory" value={`${m.cpu.toFixed(0)}% / ${m.memory.toFixed(0)}%`} tone={m.cpu > 85 ? "bad" : m.cpu > 70 ? "warn" : "ok"} />
      <Stat label={`Replica lag (stale > ${STALE_READ_SEC}s)`} value={`${m.replicaLag}s`} tone={m.replicaLag > 180 ? "bad" : m.replicaLag > STALE_READ_SEC ? "warn" : "ok"} testId="stat-replica" />
      <div className="sm:col-span-2 lg:col-span-3 text-xs muted">
        Deployment: {config.deployInProgress ? "rolling deploy in progress (2 of N workers restarted)" : "stable"}. Map reads: {config.readsFromPrimary ? "pinned to the primary" : m.staleReads ? "served STALE from the replica" : "served from the replica"}.
      </div>
    </div>
  );
}
