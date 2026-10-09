import { MAP_READ_RATIO, STALE_READ_SEC, type SimMetrics, type SimState } from "../../engine/sim/model";

/**
 * Interactive-ish architecture view: nodes for clients, gateway, workers,
 * cache, database primary and replica, queue and consumers. Edge thickness follows traffic;
 * node colour follows the component's own health so failures are visible
 * where they originate, not only where they are felt.
 */
export function ArchitectureDiagram({ state, metrics }: { state: SimState; metrics: SimMetrics }) {
  const c = state.config;
  const ok = "#10b981";
  const warn = "#f59e0b";
  const bad = "#ef4444";
  const off = "#64748b";
  const workerColor = metrics.load > 0.95 ? bad : metrics.load > 0.7 ? warn : ok;
  const cacheColor = c.cacheHitRate < 0.6 ? bad : c.cacheHitRate < 0.8 ? warn : ok;
  const dbColor = c.dbDegraded || metrics.dbSaturation > 1 ? bad : metrics.dbSaturation > 0.7 ? warn : ok;
  const queueColor = metrics.queueDepth > 1500 ? bad : metrics.queueDepth > 300 ? warn : ok;
  const consumerColor = c.queueConsumers === 0 ? off : queueColor;
  const replicaColor = state.lostWritesSec > 0 || metrics.replicaLag > 180 ? bad : metrics.replicaLag > STALE_READ_SEC ? warn : ok;
  const edge = (rps: number) => Math.max(1, Math.min(10, rps / 50));
  const missRps = c.requestsPerSec * (1 - c.cacheHitRate);
  const mapRps = c.requestsPerSec * MAP_READ_RATIO;

  const Node = ({ x, y, w, label, sub, color, testId }: { x: number; y: number; w: number; label: string; sub: string; color: string; testId?: string }) => (
    <g data-testid={testId}>
      <rect x={x} y={y} width={w} height={54} rx={8} fill="var(--panel-2)" stroke={color} strokeWidth={2.5} />
      <text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--text)">
        {label}
      </text>
      <text x={x + w / 2} y={y + 40} textAnchor="middle" fontSize="10" fill="var(--muted)">
        {sub}
      </text>
    </g>
  );
  const Edge = ({ x1, y1, x2, y2, width, color = "#94a3b8", label }: { x1: number; y1: number; x2: number; y2: number; width: number; color?: string; label?: string }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeOpacity={0.7} markerEnd="url(#arrow)" />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">
          {label}
        </text>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 760 360" className="w-full h-auto" role="img" aria-label="Architecture diagram with live health" data-testid="architecture-diagram">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>
      <Edge x1={110} y1={57} x2={180} y2={57} width={edge(c.requestsPerSec)} label={`${c.requestsPerSec} req/s`} />
      <Edge x1={300} y1={57} x2={370} y2={57} width={edge(c.requestsPerSec)} color={workerColor} />
      <Edge x1={490} y1={45} x2={580} y2={30} width={edge(c.requestsPerSec * c.cacheHitRate)} color={cacheColor} label={`${(c.cacheHitRate * 100).toFixed(0)}% hits`} />
      <Edge x1={490} y1={70} x2={580} y2={125} width={edge(missRps + (c.readsFromPrimary ? mapRps : 0))} color={dbColor} label={`${(missRps + (c.readsFromPrimary ? mapRps : 0)).toFixed(0)} qps`} />
      <Edge x1={490} y1={80} x2={580} y2={212} width={edge(c.readsFromPrimary ? 0 : mapRps)} color={c.readsFromPrimary ? off : replicaColor} label={c.readsFromPrimary ? "map reads pinned to primary" : `${mapRps.toFixed(0)} qps map reads`} />
      <Edge x1={665} y1={154} x2={665} y2={185} width={2} color={replicaColor} />
      <Edge x1={430} y1={84} x2={430} y2={260} width={edge(c.requestsPerSec * 0.3)} color={queueColor} label={`${(c.requestsPerSec * 0.3).toFixed(0)} jobs/s`} />
      <Edge x1={490} y1={287} x2={580} y2={287} width={edge(c.queueConsumers * 25)} color={consumerColor} label={`${c.queueConsumers * 25} jobs/s`} />
      <Node x={10} y={30} w={100} label="Clients" sub="dispatch + partners" color={ok} />
      <Node x={180} y={30} w={120} label="API gateway" sub={`${(metrics.errorRate * 100).toFixed(1)}% errors`} color={metrics.errorRate > 0.03 ? (metrics.errorRate > 0.2 ? bad : warn) : ok} />
      <Node x={370} y={30} w={120} label={`API workers ×${c.workers}`} sub={`load ${(metrics.load * 100).toFixed(0)}%`} color={workerColor} testId="node-workers" />
      <Node x={580} y={5} w={170} label="Cache" sub={`hit ratio ${(c.cacheHitRate * 100).toFixed(0)}%`} color={cacheColor} testId="node-cache" />
      <Node x={580} y={100} w={170} label="DB primary" sub={c.dbDegraded ? "DEGRADED: replica lag" : `${metrics.dbQps.toFixed(0)} / 100 qps`} color={dbColor} testId="node-db" />
      <Node x={580} y={185} w={170} label="DB replica" sub={state.lostWritesSec > 0 ? `promoted ${state.lostWritesSec}s behind: data loss` : c.replicaBlocked ? `lag ${metrics.replicaLag}s, apply BLOCKED` : `lag ${metrics.replicaLag}s`} color={replicaColor} testId="node-replica" />
      <Node x={370} y={260} w={120} label="Job queue" sub={`depth ${metrics.queueDepth}`} color={queueColor} testId="node-queue" />
      <Node x={580} y={260} w={170} label={`Consumers ×${c.queueConsumers}`} sub={c.queueConsumers === 0 ? "none running" : `${c.queueConsumers * 25} jobs/s capacity`} color={consumerColor} testId="node-consumers" />
      {c.deployInProgress && (
        <text x={10} y={350} fontSize="11" fill={warn}>
          Rolling deploy in progress
        </text>
      )}
    </svg>
  );
}
