import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { NETWORK_EXERCISES, NETWORK_EXERCISE_BY_ID, type NetworkExercise } from "../content/study/networkExercises";
import { nowIso } from "../data/db";
import { hubToText, parseHubRoutes, parseRoutes, parseStatefulRules, parseStatelessRules, routesToText, statefulToText, statelessToText, trace, type ParseError, type Topology, type TraceResult } from "../engine/network/trace";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Network path lab. A fictional virtual network, one editable component,
 * flows that must reach or be dropped, and a hop-by-hop trace that names
 * the hop which dropped the packet. Passing credits the Study objectives
 * curated for the exercise (Guided at most).
 */
export function NetworkLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = NETWORK_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? NETWORK_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

function editableText(ex: NetworkExercise): string {
  const t = ex.topology;
  const e = ex.editable;
  for (const n of t.networks) {
    if (e.kind === "stateful") {
      const f = n.statefulFilters.find((x) => x.id === e.id);
      if (f) return statefulToText(f);
    }
    if (e.kind === "stateless") {
      const f = n.statelessFilters.find((x) => x.id === e.id);
      if (f) return statelessToText(f);
    }
    if (e.kind === "routes") {
      const r = n.routeTables.find((x) => x.id === e.id);
      if (r) return routesToText(r);
    }
  }
  if (e.kind === "hub") {
    const h = t.hubs.find((x) => x.id === e.id);
    if (h) return hubToText(h);
  }
  return "";
}

/** Applies the edited text to a copy of the topology. */
export function applyEdit(ex: NetworkExercise, text: string): { topology: Topology; errors: ParseError[] } {
  const e = ex.editable;
  const t: Topology = JSON.parse(JSON.stringify(ex.topology));
  let errors: ParseError[] = [];
  for (const n of t.networks) {
    if (e.kind === "stateful") {
      const f = n.statefulFilters.find((x) => x.id === e.id);
      if (f) {
        const r = parseStatefulRules(text);
        f.rules = r.rules;
        errors = r.errors;
      }
    } else if (e.kind === "stateless") {
      const f = n.statelessFilters.find((x) => x.id === e.id);
      if (f) {
        const r = parseStatelessRules(text);
        f.rules = r.rules;
        errors = r.errors;
      }
    } else if (e.kind === "routes") {
      const rt = n.routeTables.find((x) => x.id === e.id);
      if (rt) {
        const r = parseRoutes(text);
        rt.routes = r.routes;
        errors = r.errors;
      }
    }
  }
  if (e.kind === "hub") {
    const h = t.hubs.find((x) => x.id === e.id);
    if (h) {
      const r = parseHubRoutes(text);
      h.routes = r.routes;
      errors = r.errors;
    }
  }
  return { topology: t, errors };
}

const EDITABLE_HELP = {
  stateful: 'Stateful filter, one rule per line: "in|out <proto> <port|range|any> from|to <cidr|filter:id>". The reply to an allowed flow is allowed automatically.',
  stateless: 'Stateless filter, one rule per line: "<number|*> allow|deny in|out <proto> <port|range|any> <cidr>". Lowest number matches first; replies need their own outbound rule on 1024-65535.',
  routes: 'Route table, one route per line: "<cidr|service:name> -> <local|internet-gateway|nat:id|hub:id|endpoint:id|peer:network|blackhole>". The most specific destination wins.',
  hub: 'Hub routes, one per line: "<cidr> -> <network id>". The hub must know every attached network, in both directions.',
} as const;

function ExerciseView({ exercise, fromPath, pick }: { exercise: NetworkExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [text, setText] = useState(() => editableText(exercise));
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const applied = useMemo(() => applyEdit(exercise, text), [exercise, text]);
  const results = useMemo(() => exercise.flows.map((f) => ({ ...f, result: trace(applied.topology, f.flow) })), [exercise, applied]);
  const allRight = applied.errors.length === 0 && results.every((r) => (r.expect === "reach") === r.result.reachable);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = NETWORK_EXERCISES[NETWORK_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Network path" subtitle="Trace a packet through a fictional virtual network: stateful and stateless filters, route tables with longest-prefix matching, an address translator, private endpoints and a hub router. The trace names the hop that dropped it. Vendor-neutral names throughout." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="network-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {NETWORK_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`network-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="network-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0 break-words">
          <Panel title={`Editable: ${exercise.editable.id} (${exercise.editable.kind === "routes" ? "route table" : exercise.editable.kind === "hub" ? "hub routes" : `${exercise.editable.kind} filter`})`}>
            <p className="muted text-xs mb-1">{EDITABLE_HELP[exercise.editable.kind]}</p>
            <textarea className="input font-mono text-xs min-h-28" value={text} onChange={(e) => setText(e.target.value)} data-testid="network-editable" aria-label={`Edit ${exercise.editable.id}`} />
            {applied.errors.length > 0 && (
              <ul className="text-xs text-red-500 mt-1" data-testid="network-errors">
                {applied.errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <TopologyView topology={applied.topology} editable={exercise.editable.id} />
        </div>
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Flows that must come out right">
            <ul className="space-y-2" data-testid="network-flows">
              {results.map((r) => {
                const ok = (r.expect === "reach") === r.result.reachable;
                return (
                  <li key={r.id} className={`panel-2 p-2 text-sm border ${ok ? "border-emerald-500/60" : "border-red-500/60"}`} data-testid={`network-flow-${r.id}`} data-ok={ok ? "1" : "0"}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-right text-xs shrink-0">
                        <div>
                          now: <strong data-testid={`network-result-${r.id}`}>{r.result.reachable ? (r.result.viaInternet ? "reaches (via internet)" : "reaches") : "dropped"}</strong>
                        </div>
                        <div className="muted">want: {r.expect === "reach" ? "reaches" : "dropped"}</div>
                      </div>
                    </div>
                    {r.result.droppedAt && <p className="text-xs mt-1">Dropped at <strong>{r.result.droppedAt.where}</strong>: {r.result.droppedAt.detail}</p>}
                    <button type="button" className="btn-ghost text-xs mt-1" onClick={() => setOpen(open === r.id ? null : r.id)} data-testid={`network-trace-toggle-${r.id}`}>
                      {open === r.id ? "Hide trace" : "Show trace"}
                    </button>
                    {open === r.id && <TraceView result={r.result} />}
                  </li>
                );
              })}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="network-check">
              {passed ? "Passed" : allRight ? "Every flow is right: mark as passed" : "Not yet: fix the configuration until every flow matches"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="network-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="network-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="network-passed">{credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}</span>{" "}
              {next ? (
                <button type="button" className="underline" onClick={() => pick(next.id)}>
                  Next: {next.title}
                </button>
              ) : (
                "That was the last exercise."
              )}
              {fromPath && (
                <>
                  {" "}
                  <Link to={fromPath} className="underline">Back to the unit</Link>.
                </>
              )}
            </Callout>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceView({ result }: { result: TraceResult }) {
  return (
    <ol className="mt-2 space-y-1 text-xs" data-testid="network-trace">
      {result.hops.map((h) => (
        <li key={h.n} className={`flex gap-2 ${h.verdict === "drop" ? "text-red-500" : ""}`}>
          <span className="shrink-0">{h.verdict === "drop" ? "✖" : "✔"}</span>
          <span>
            <strong>{h.where}</strong>: {h.detail}
          </span>
        </li>
      ))}
      {result.flowLog.map((l) => (
        <li key={l} className="font-mono muted">
          {l}
        </li>
      ))}
    </ol>
  );
}

function TopologyView({ topology, editable }: { topology: Topology; editable: string }) {
  return (
    <Panel title="Topology">
      <div className="space-y-3 text-xs" data-testid="network-topology">
        {topology.networks.map((n) => (
          <div key={n.id}>
            <div className="font-medium">
              {n.id} ({n.cidr}){n.internetGateway ? ", internet gateway" : ", no internet gateway"}
            </div>
            <ul className="pl-3 space-y-1 mt-1">
              {n.subnets.map((s) => {
                const rt = n.routeTables.find((r) => r.id === s.routeTable);
                return (
                  <li key={s.id}>
                    <strong>{s.id}</strong> {s.cidr}, routes <span className={s.routeTable === editable ? "accent" : ""}>{s.routeTable}</span>
                    {rt ? ` [${rt.routes.map((r) => `${r.dest} → ${r.target}`).join("; ")}]` : ""}
                    {s.statelessFilter ? (
                      <>
                        , stateless filter <span className={s.statelessFilter === editable ? "accent" : ""}>{s.statelessFilter}</span>
                      </>
                    ) : null}
                    <ul className="pl-3 muted">
                      {n.hosts
                        .filter((h) => h.subnet === s.id)
                        .map((h) => (
                          <li key={h.id}>
                            {h.id} {h.ip}
                            {h.publicIp ? ` (public ${h.publicIp})` : ""}, filters {h.filters.map((f) => <span key={f} className={f === editable ? "accent" : ""}>{f} </span>)}
                          </li>
                        ))}
                      {n.nats.filter((x) => x.subnet === s.id).map((x) => <li key={x.id}>address translator {x.id}</li>)}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {n.statefulFilters.length > 0 && (
              <div className="pl-3 mt-1 muted">
                stateful filters:{" "}
                {n.statefulFilters.map((f) => (
                  <span key={f.id} className={f.id === editable ? "accent" : ""}>
                    {f.id} [{f.rules.map((r) => `${r.direction} ${r.proto} ${r.ports === "any" ? "any" : r.ports.join("-")} ${r.source}`).join("; ")}]{" "}
                  </span>
                ))}
              </div>
            )}
            {n.endpoints.length > 0 && <div className="pl-3 muted">private endpoints: {n.endpoints.map((e) => `${e.id} (service:${e.service})`).join(", ")}</div>}
          </div>
        ))}
        {topology.hubs.map((h) => (
          <div key={h.id}>
            <div className="font-medium">
              hub {h.id}, attached: {h.attached.join(", ")}
            </div>
            <div className={`pl-3 ${h.id === editable ? "accent" : "muted"}`}>routes: {h.routes.map((r) => `${r.dest} → ${r.network}`).join("; ") || "none"}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
