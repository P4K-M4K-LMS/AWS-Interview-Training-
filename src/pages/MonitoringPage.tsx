import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BASELINE_CONFIG, computeMetrics, createState, generateLogs, step, type SimState } from "../engine/sim/model";
import type { SimConfig } from "../domain/types";
import { MetricsGrid, Sparkline } from "../components/sim/SimDashboard";
import { ArchitectureDiagram } from "../components/sim/ArchitectureDiagram";
import { Callout, PageHeader, Panel } from "../components/ui";
import { missionsForTrack } from "../content/missions";

/**
 * Free-play observability dashboard on the shared simulation engine.
 * Metrics react coherently to the controls; incidents reuse the same model.
 */
export function MonitoringPage() {
  const [config, setConfig] = useState<SimConfig>(BASELINE_CONFIG);
  const [state, setState] = useState<SimState>(() => createState(BASELINE_CONFIG));
  const [history, setHistory] = useState<Array<{ p95: number; err: number; depth: number }>>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(() => setState((s) => step(s, config)), 1000);
    return () => clearInterval(id);
  }, [config]);

  const m = useMemo(() => computeMetrics({ ...state, config }), [state, config]);
  useEffect(() => {
    setHistory((h) => [...h, { p95: m.latencyP95, err: m.errorRate * 100, depth: m.queueDepth }].slice(-60));
    setLogs((l) => [...l, ...generateLogs({ ...state, config }, m)].slice(-80));
  }, [m, state, config]);

  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const incidents = missionsForTrack("devops").concat(missionsForTrack("distributed"), missionsForTrack("serverless")).filter((x) => x.kind === "incident");

  return (
    <div className="space-y-4">
      <PageHeader title="System Monitoring" subtitle="A simulated observability dashboard for the fictional fleet API. Metrics react coherently to the controls; they are a model, not random numbers. Incident missions run on this same model." />
      <div className="grid lg:grid-cols-[1fr_20rem] gap-4">
        <div className="space-y-4">
          <MetricsGrid m={m} config={config} />
          <Panel title="Last 60 seconds">
            <div className="grid md:grid-cols-3 gap-3">
              <Sparkline data={history.map((h) => h.p95)} max={2000} color="#f59e0b" label="p95 latency (ms)" />
              <Sparkline data={history.map((h) => h.err)} max={60} color="#ef4444" label="error rate (%)" />
              <Sparkline data={history.map((h) => h.depth)} max={2000} color="#38bdf8" label="queue depth" />
            </div>
          </Panel>
          <Panel title="Architecture">
            <ArchitectureDiagram state={{ ...state, config }} metrics={m} />
          </Panel>
          <Panel title="Logs">
            <div className="terminal rounded-lg p-3 h-40 overflow-auto text-xs whitespace-pre-wrap" role="log">
              {logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : <div className="text-slate-400">Waiting for events…</div>}
            </div>
          </Panel>
          <Callout kind="info" title="How to read this">
            Load = requests ÷ (workers × 60). Above ~70% load latency climbs; above ~95% errors appear. Cache misses become database queries (capacity ~100 qps), and a degraded database multiplies their cost. Queue depth grows when producers (0.3 jobs per request) out-pace consumers (25 jobs/s each). Dispatcher map reads (0.4 per request) bypass the cache and are served by a read replica that replays about 3 s of writes per second; while its apply thread is blocked it falls behind 1 s per second, and map reads older than 5 s are stale.
          </Callout>
          <Panel title="Incident missions on this platform">
            <ul className="text-sm space-y-1">
              {incidents.map((i) => (
                <li key={i.id}>
                  <Link to={`/missions/${i.id}`} className="hover:underline">
                    {i.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <Panel title="Simulation controls">
          <div className="space-y-3 text-sm">
            <Slider label={`Traffic: ${config.requestsPerSec} req/s`} min={10} max={600} value={config.requestsPerSec} onChange={(v) => set("requestsPerSec", v)} />
            <Slider label={`Workers: ${config.workers}`} min={1} max={16} value={config.workers} onChange={(v) => set("workers", v)} />
            <Slider label={`Cache hit rate: ${(config.cacheHitRate * 100).toFixed(0)}%`} min={0} max={100} value={Math.round(config.cacheHitRate * 100)} onChange={(v) => set("cacheHitRate", v / 100)} />
            <Slider label={`Queue consumers: ${config.queueConsumers}`} min={0} max={12} value={config.queueConsumers} onChange={(v) => set("queueConsumers", v)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.dbDegraded} onChange={(e) => set("dbDegraded", e.target.checked)} /> Inject: database degraded
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.deployInProgress} onChange={(e) => set("deployInProgress", e.target.checked)} /> Inject: deploy in progress
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!config.replicaBlocked} onChange={(e) => set("replicaBlocked", e.target.checked)} /> Inject: replica apply thread blocked
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!config.readsFromPrimary} onChange={(e) => set("readsFromPrimary", e.target.checked)} /> Mitigate: pin map reads to the primary
            </label>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => {
                setConfig(BASELINE_CONFIG);
                setState(createState(BASELINE_CONFIG));
              }}
            >
              Reset to baseline
            </button>
            <div className="text-xs muted">Scenario ideas: (1) traffic 400 with 4 workers, then scale workers. (2) cache 30%: watch db qps, then raise the hit rate. (3) consumers 0 and watch the queue, then restore them. (4) block the replica, watch lag and stale reads, pin reads to the primary (note the extra db qps), then unblock and watch lag drain.</div>
          </div>
        </Panel>
      </div>
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
