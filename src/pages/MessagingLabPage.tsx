import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { MESSAGING_EXERCISES, MESSAGING_EXERCISE_BY_ID, type MessagingExercise } from "../content/study/messagingExercises";
import { nowIso } from "../data/db";
import { checkMessaging, describeIntegration, type Integration, type Outcome } from "../engine/messaging/simulate";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Messaging and events lab. Pick how messages travel from a producer to its
 * consumers (direct calls, a job queue, a pub/sub topic, a partitioned
 * stream) and watch what the choice costs: lost messages, duplicate
 * processing, broken order, wasted attempts, backlog and the oldest wait.
 * Passing credits the Study objectives curated for the exercise (Guided at most).
 */
export function MessagingLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = MESSAGING_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? MESSAGING_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

const KINDS: Array<{ kind: Integration["kind"]; label: string; what: string }> = [
  { kind: "direct", label: "Direct calls", what: "The producer calls a consumer and waits. Nothing in between: no backlog, and nothing to hold work when consumers are down or busy." },
  { kind: "queue", label: "Job queue", what: "Messages wait in order; consumers pull them. A received message is hidden for the redelivery delay, then offered again unless acknowledged; a receive limit parks or drops it." },
  { kind: "topic", label: "Pub/sub topic", what: "One message fans out to every subscriber. A subscription can filter by type and can be buffered by its own queue." },
  { kind: "stream", label: "Partitioned stream", what: "Shards, each read in order by one consumer. The partition key decides which messages share a shard and so stay ordered." },
];

function withKind(exercise: MessagingExercise, i: Integration, kind: Integration["kind"]): Integration {
  switch (kind) {
    case "direct":
      return { kind };
    case "queue":
      return i.kind === "queue" ? i : { kind, redeliverySeconds: 30, maxReceives: null, deadLetter: false, ordered: false, idempotent: false };
    case "topic":
      return i.kind === "topic" ? i : { kind, subscribers: exercise.scenario.subscribers.map((s) => ({ name: s.name, filter: null, buffered: false })) };
    case "stream":
      return i.kind === "stream" ? i : { kind, shards: 1, partitionBy: "random" };
  }
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: MessagingExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [integration, setIntegration] = useState<Integration>(exercise.start);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { outcome, checks } = useMemo(() => checkMessaging(exercise.scenario, integration, exercise.requirement), [exercise, integration]);
  const allRight = checks.every((c) => c.passed);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = MESSAGING_EXERCISES[MESSAGING_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];
  const { producer, consumers, subscribers } = exercise.scenario;
  const types = producer.types.map((t) => t.type);
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Messaging and events" subtitle="How messages get from a producer to its consumers, simulated second by second: direct calls, a job queue, a pub/sub topic or a partitioned stream. The outcome counts what each choice costs: lost messages, duplicate processing, order broken within an entity, attempts wasted on poison messages, backlog and the oldest wait. Vendor-neutral; the numbers are the platform's own." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="messaging-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {MESSAGING_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`messaging-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="messaging-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 muted" data-testid="messaging-setup">
          <span>
            Producer: {producer.ratePerSec}/s for {producer.seconds} s{producer.duplicateShare ? `, ${Math.round(producer.duplicateShare * 100)}% sent twice` : ""}{producer.poisonShare ? `, ${Math.round(producer.poisonShare * 100)}% poison` : ""}{producer.hotEntityShare ? `, one entity sends ${Math.round(producer.hotEntityShare * 100)}%` : ""}
            {types.length > 1 ? `; types ${types.join(", ")}` : ""}
          </span>
          <span>
            Consumers: {consumers.count} × {consumers.serviceSeconds} s{consumers.serviceJitter ? ` ± ${Math.round(consumers.serviceJitter * 100)}%` : ""}
            {consumers.outage ? `, down ${consumers.outage.from}–${consumers.outage.to} s` : ""}
            {integration.kind === "stream" ? " (one per shard)" : subscribers.length ? " per subscriber" : ""}
          </span>
          {subscribers.length > 0 && <span>Subscribers: {subscribers.map((s) => `${s.name} needs ${s.needs.join(" + ")}${s.outage ? ` (down ${s.outage.from}–${s.outage.to} s)` : ""}`).join("; ")}</span>}
        </div>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Panel title="Integration">
            <div className="space-y-2 text-sm">
              {KINDS.map((k) => (
                <label key={k.kind} className="flex items-start gap-2">
                  <input type="radio" name="integration" checked={integration.kind === k.kind} onChange={() => setIntegration((i) => withKind(exercise, i, k.kind))} data-testid={`messaging-kind-${k.kind}`} />
                  <span>
                    <strong>{k.label}.</strong> <span className="muted">{k.what}</span>
                  </span>
                </label>
              ))}
            </div>
            {integration.kind === "queue" && (
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <label className="block">
                  <span className="label">Redelivery delay (s)</span>
                  <input type="number" min={1} max={600} className="input" value={integration.redeliverySeconds} onChange={(e) => setIntegration({ ...integration, redeliverySeconds: num(e.target.value, 1, 600) })} data-testid="messaging-redelivery" />
                </label>
                <label className="block">
                  <span className="label">Receive limit (0 = unlimited)</span>
                  <input type="number" min={0} max={100} className="input" value={integration.maxReceives ?? 0} onChange={(e) => setIntegration({ ...integration, maxReceives: num(e.target.value, 0, 100) || null })} data-testid="messaging-max-receives" />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={integration.deadLetter} onChange={(e) => setIntegration({ ...integration, deadLetter: e.target.checked })} data-testid="messaging-dead-letter" /> Dead-letter queue after the limit (else drop)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={integration.ordered} onChange={(e) => setIntegration({ ...integration, ordered: e.target.checked })} data-testid="messaging-ordered" /> Ordered: one entity at a time, duplicates suppressed by id
                </label>
                <label className="flex items-center gap-2 col-span-2">
                  <input type="checkbox" checked={integration.idempotent} onChange={(e) => setIntegration({ ...integration, idempotent: e.target.checked })} data-testid="messaging-idempotent" /> Idempotent consumers (a message seen before is skipped)
                </label>
              </div>
            )}
            {integration.kind === "topic" && (
              <div className="mt-3 text-sm space-y-2" data-testid="messaging-subscribers">
                {integration.subscribers.map((s, idx) => (
                  <div key={s.name} className="panel-2 p-2">
                    <div className="font-semibold">{s.name}</div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={s.filter === null} onChange={(e) => update(idx, { filter: e.target.checked ? null : [] })} data-testid={`messaging-sub-${s.name}-all`} /> everything
                      </label>
                      {types.map((t) => (
                        <label key={t} className="flex items-center gap-1">
                          <input type="checkbox" checked={s.filter === null || s.filter.includes(t)} disabled={s.filter === null} onChange={(e) => update(idx, { filter: e.target.checked ? [...(s.filter ?? []), t] : (s.filter ?? []).filter((x) => x !== t) })} data-testid={`messaging-sub-${s.name}-${t}`} /> {t}
                        </label>
                      ))}
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={s.buffered} onChange={(e) => update(idx, { buffered: e.target.checked })} data-testid={`messaging-sub-${s.name}-buffered`} /> buffered by a queue
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {integration.kind === "stream" && (
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <label className="block">
                  <span className="label">Shards</span>
                  <input type="number" min={1} max={64} className="input" value={integration.shards} onChange={(e) => setIntegration({ ...integration, shards: num(e.target.value, 1, 64) })} data-testid="messaging-shards" />
                </label>
                <label className="block">
                  <span className="label">Partition by</span>
                  <select className="input" value={integration.partitionBy} onChange={(e) => setIntegration({ ...integration, partitionBy: e.target.value as "random" | "entity" })} data-testid="messaging-partition">
                    <option value="random">nothing (spread evenly)</option>
                    <option value="entity">entity</option>
                  </select>
                </label>
              </div>
            )}
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="What happened">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Delivered" value={String(outcome.delivered)} id="delivered" />
              <Stat label="Lost" value={String(outcome.lost)} id="lost" />
              <Stat label="Processed twice" value={String(outcome.duplicatesProcessed)} id="duplicates" />
              <Stat label="Out of order" value={String(outcome.outOfOrder)} id="ooo" />
              <Stat label="Wasted attempts" value={`${outcome.wastedAttempts}${outcome.deadLettered ? ` (${outcome.deadLettered} parked)` : ""}`} id="wasted" />
              <Stat label="Oldest wait" value={`${outcome.maxAgeSeconds} s`} id="age" />
            </div>
            {Object.keys(outcome.perSubscriber).length > 0 && (
              <ul className="text-xs mt-2 muted" data-testid="messaging-per-subscriber">
                {Object.entries(outcome.perSubscriber).map(([name, p]) => (
                  <li key={name} data-testid={`messaging-sub-${name}-outcome`}>
                    {name}: {p.wanted} wanted, {p.unwanted} noise, {p.lost} lost
                  </li>
                ))}
              </ul>
            )}
            <Timeline outcome={outcome} />
          </Panel>
          <Panel title="Checks">
            <ul className="space-y-1 text-sm" data-testid="messaging-checks">
              {checks.map((c) => (
                <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`messaging-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                  <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                  <span>
                    {c.label}: <span className="muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="messaging-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: change the integration"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="messaging-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="messaging-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="messaging-passed">
                {describeIntegration(integration)}. {credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}
              </span>{" "}
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

  function update(idx: number, patch: Partial<Extract<Integration, { kind: "topic" }>["subscribers"][number]>) {
    if (integration.kind !== "topic") return;
    setIntegration({ ...integration, subscribers: integration.subscribers.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  }
}

function Stat({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="panel-2 p-2">
      <div className="label">{label}</div>
      <div className="font-semibold" data-testid={`messaging-${id}`}>
        {value}
      </div>
    </div>
  );
}

/** Backlog over time, with the cumulative lost and wasted counts beneath. */
function Timeline({ outcome }: { outcome: Outcome }) {
  const w = 320;
  const h = 36;
  const n = Math.max(2, outcome.ticks.length);
  const maxBacklog = Math.max(1, outcome.maxBacklog);
  const points = outcome.ticks.map((t, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (t.backlog / maxBacklog) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <div className="mt-3 text-xs" data-testid="messaging-timeline">
      <div className="muted">Backlog (peak {outcome.maxBacklog})</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" role="img" aria-label={`Backlog over ${outcome.ticks.length} seconds, peak ${outcome.maxBacklog}`}>
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
      </svg>
      <div className="muted">
        {outcome.ticks.length} s shown. {outcome.drainedAt === null ? "Not drained by the end." : `Drained at ${outcome.drainedAt} s.`}
      </div>
    </div>
  );
}
