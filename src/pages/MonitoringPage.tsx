import { useEffect, useMemo, useState } from "react";
import { Callout, PageHeader, Panel } from "../components/ui";

/**
 * Deterministic monitoring simulation. Metrics are derived from the
 * configuration (traffic, workers, cache, failure injection) with a small
 * seeded jitter, so changes produce coherent, explainable effects. This is a
 * teaching model, not random noise.
 */
interface Config {
  requestsPerSec: number;
  workers: number;
  cacheHitRate: number;
  dbDegraded: boolean;
  deployInProgress: boolean;
  queueConsumers: number;
}

const DEFAULT: Config = { requestsPerSec: 120, workers: 4, cacheHitRate: 0.85, dbDegraded: false, deployInProgress: false, queueConsumers: 2 };

function jitter(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function computeMetrics(c: Config, t: number) {
  const capacity = c.workers * 60; // each worker ~60 rps
  const load = c.requestsPerSec / capacity; // 1.0 = saturated
  const dbCost = c.dbDegraded ? 4 : 1;
  const missRate = 1 - c.cacheHitRate;
  const baseLatency = 18 + missRate * 120 * dbCost + Math.max(0, load - 0.7) * 400 + (c.deployInProgress ? 60 : 0);
  const errorRate = Math.min(0.6, Math.max(0, load - 0.95) * 1.2 + (c.dbDegraded ? 0.05 + missRate * 0.2 : 0) + (c.deployInProgress ? 0.01 : 0));
  const cpu = Math.min(100, 8 + load * 70 + jitter(1, t) * 4);
  const memory = Math.min(100, 30 + c.workers * 6 + (c.dbDegraded ? 10 : 0) + jitter(2, t) * 3);
  const disk = 61 + jitter(3, Math.floor(t / 20)) * 2;
  const produced = c.requestsPerSec * 0.3;
  const consumed = c.queueConsumers * 25;
  const queueDepth = Math.max(0, Math.round((produced - consumed) * 15 + (c.dbDegraded ? 200 : 0) + jitter(4, t) * 5));
  const p95 = baseLatency * 2.4 + jitter(5, t) * 10;
  const health = errorRate > 0.2 || p95 > 1500 ? "critical" : errorRate > 0.03 || p95 > 500 || queueDepth > 300 ? "degraded" : "healthy";
  return { cpu, memory, disk, latencyP50: baseLatency + jitter(6, t) * 5, latencyP95: p95, errorRate, queueDepth, health, requestsPerSec: c.requestsPerSec * (1 - errorRate * 0.5), load };
}

export function MonitoringPage() {
  const [config, setConfig] = useState<Config>(DEFAULT);
  const [t, setT] = useState(0);
  const [history, setHistory] = useState<Array<ReturnType<typeof computeMetrics>>>([]);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = useMemo(() => computeMetrics(config, t), [config, t]);
  useEffect(() => {
    setHistory((h) => [...h, m].slice(-60));
  }, [m]);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <div className="space-y-4">
      <PageHeader title="System Monitoring" subtitle="A simulated observability dashboard for the fictional fleet API. Metrics react coherently to the controls on the right; they are a model, not random numbers." />
      <div className="grid lg:grid-cols-[1fr_20rem] gap-4">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Service health" value={m.health} tone={m.health === "healthy" ? "ok" : m.health === "degraded" ? "warn" : "bad"} />
            <Stat label="Requests / s" value={m.requestsPerSec.toFixed(0)} />
            <Stat label="Error rate" value={`${(m.errorRate * 100).toFixed(1)}%`} tone={m.errorRate > 0.03 ? (m.errorRate > 0.2 ? "bad" : "warn") : "ok"} />
            <Stat label="Queue depth" value={String(m.queueDepth)} tone={m.queueDepth > 300 ? "warn" : "ok"} />
            <Stat label="CPU" value={`${m.cpu.toFixed(0)}%`} tone={m.cpu > 85 ? "bad" : m.cpu > 70 ? "warn" : "ok"} />
            <Stat label="Memory" value={`${m.memory.toFixed(0)}%`} tone={m.memory > 85 ? "warn" : "ok"} />
            <Stat label="Disk" value={`${m.disk.toFixed(0)}%`} />
            <Stat label="Latency p50 / p95" value={`${m.latencyP50.toFixed(0)} / ${m.latencyP95.toFixed(0)} ms`} tone={m.latencyP95 > 500 ? (m.latencyP95 > 1500 ? "bad" : "warn") : "ok"} />
          </div>
          <Panel title="Last 60 seconds: p95 latency (ms) and error rate (%)">
            <Sparkline data={history.map((h) => h.latencyP95)} max={2000} color="#f59e0b" label="p95 latency" />
            <Sparkline data={history.map((h) => h.errorRate * 100)} max={60} color="#ef4444" label="error rate" />
          </Panel>
          <Panel title="Deployment status">
            <div className="text-sm">
              {config.deployInProgress ? "Rolling deploy in progress: 2/4 workers on v2.3.1, latency temporarily elevated." : "Stable: all workers on v2.3.0."}
            </div>
          </Panel>
          <Callout kind="info" title="How to read this">
            Load = requests ÷ (workers × 60). Above ~70% load, latency climbs; above ~95%, errors appear. Cache misses multiply database cost, and a degraded database multiplies it again. Queue depth grows when producers out-pace consumers. Try reproducing an incident, then fixing it with the smallest change.
          </Callout>
        </div>
        <Panel title="Simulation controls">
          <div className="space-y-3 text-sm">
            <Slider label={`Traffic: ${config.requestsPerSec} req/s`} min={10} max={600} value={config.requestsPerSec} onChange={(v) => set("requestsPerSec", v)} />
            <Slider label={`Workers: ${config.workers}`} min={1} max={12} value={config.workers} onChange={(v) => set("workers", v)} />
            <Slider label={`Cache hit rate: ${(config.cacheHitRate * 100).toFixed(0)}%`} min={0} max={100} value={Math.round(config.cacheHitRate * 100)} onChange={(v) => set("cacheHitRate", v / 100)} />
            <Slider label={`Queue consumers: ${config.queueConsumers}`} min={0} max={8} value={config.queueConsumers} onChange={(v) => set("queueConsumers", v)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.dbDegraded} onChange={(e) => set("dbDegraded", e.target.checked)} /> Inject: database degraded
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.deployInProgress} onChange={(e) => set("deployInProgress", e.target.checked)} /> Inject: deploy in progress
            </label>
            <button type="button" className="btn-secondary w-full" onClick={() => setConfig(DEFAULT)}>
              Reset to baseline
            </button>
            <div className="text-xs muted">Scenario ideas: (1) traffic 400 with 4 workers, then scale workers. (2) cache 30% + db degraded: which lever helps more? (3) consumers 0 and watch the queue.</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-red-400";
  return (
    <div className="panel p-3">
      <div className="label">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}

function Sparkline({ data, max, color, label }: { data: number[]; max: number; color: string; label: string }) {
  const w = 600;
  const h = 60;
  const pts = data.map((v, i) => `${(i / 59) * w},${h - Math.min(1, v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" role="img" aria-label={`${label}, latest ${data[data.length - 1]?.toFixed(0) ?? "n/a"}`}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}
