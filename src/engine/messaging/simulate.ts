import type { CheckResult } from "../../domain/types";

/**
 * Messaging and events on the fictional platform, simulated second by second
 * with sub-second service times. A producer emits messages (some duplicated by
 * producer retries, some poison that always fail); an integration carries
 * them to consumers: direct calls (nothing in between), a job queue
 * (redelivery delay, receive limit, dead-letter queue, ordered mode with
 * per-group locking and de-duplication), a pub/sub topic (subscribers with
 * type filters, buffered or not) or a partitioned stream (shards, partition
 * key). The outcome counts what every integration decision costs: lost
 * messages, duplicate processing, order broken per entity, wasted attempts,
 * backlog and the oldest wait. Vendor-neutral; the numbers are the platform's own.
 */
export interface Producer {
  ratePerSec: number;
  seconds: number;
  /** Share of messages the producer sends twice (a retry after a lost acknowledgement), one second apart. */
  duplicateShare: number;
  /** Share of messages that always fail in the consumer. */
  poisonShare: number;
  types: Array<{ type: string; share: number }>;
  entities: number;
  /** Share of traffic belonging to entity 0 (a hot customer); the rest is spread evenly. */
  hotEntityShare: number;
}

export interface Consumers {
  count: number;
  serviceSeconds: number;
  /** ± fraction of serviceSeconds, so parallel consumers finish in a different order than they started. */
  serviceJitter: number;
  outage: { from: number; to: number } | null;
}

export interface SubscriberNeed {
  name: string;
  /** Message types this subscriber needs. Anything else delivered to it is noise. */
  needs: string[];
  outage: { from: number; to: number } | null;
}

export interface Scenario {
  producer: Producer;
  consumers: Consumers;
  subscribers: SubscriberNeed[];
}

export type Integration =
  | { kind: "direct" }
  | { kind: "queue"; redeliverySeconds: number; maxReceives: number | null; deadLetter: boolean; ordered: boolean; idempotent: boolean }
  | { kind: "topic"; subscribers: Array<{ name: string; filter: string[] | null; buffered: boolean }> }
  | { kind: "stream"; shards: number; partitionBy: "random" | "entity" };

export interface Requirement {
  maxLost: number;
  maxDuplicates: number;
  maxOutOfOrder: number;
  maxAgeSeconds: number;
  drainWithinSeconds: number;
  maxWastedAttempts?: number;
  /** Every poison message must end in the dead-letter queue (none dropped, none retried forever). */
  parkPoison?: boolean;
  maxShards?: number;
}

export interface Outcome {
  delivered: number;
  lost: number;
  duplicatesProcessed: number;
  suppressedDuplicates: number;
  outOfOrder: number;
  deadLettered: number;
  wastedAttempts: number;
  poisonSent: number;
  maxBacklog: number;
  maxAgeSeconds: number;
  drainedAt: number | null;
  perSubscriber: Record<string, { wanted: number; unwanted: number; lost: number }>;
  ticks: Array<{ t: number; backlog: number; delivered: number; lost: number; wasted: number }>;
}

interface Msg {
  id: number;
  entity: number;
  seq: number;
  type: string;
  poison: boolean;
  createdAt: number;
}
interface Item {
  msg: Msg;
  visibleAt: number;
  receives: number;
}
interface Slot {
  freeAt: number;
  item: Item | null;
  queue: Queue | null;
  sub: string | null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Queue {
  items: Item[] = [];
  seen = new Set<number>();
  readonly opts: { redeliverySeconds: number; maxReceives: number | null; deadLetter: boolean; ordered: boolean };
  readonly onDrop: (reason: "dead-letter" | "lost") => void;
  constructor(opts: Queue["opts"], onDrop: Queue["onDrop"]) {
    this.opts = opts;
    this.onDrop = onDrop;
  }
  enqueue(msg: Msg, out: Outcome) {
    if (this.opts.ordered) {
      if (this.seen.has(msg.id)) {
        out.suppressedDuplicates += 1;
        return;
      }
      this.seen.add(msg.id);
    }
    this.items.push({ msg, visibleAt: msg.createdAt, receives: 0 });
  }
  pull(now: number, locked: Set<number>): Item | null {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.visibleAt > now) continue;
      if (this.opts.ordered && locked.has(it.msg.entity)) continue;
      if (this.opts.maxReceives !== null && it.receives >= this.opts.maxReceives) {
        this.items.splice(i, 1);
        this.onDrop(this.opts.deadLetter ? "dead-letter" : "lost");
        i -= 1;
        continue;
      }
      it.receives += 1;
      it.visibleAt = now + this.opts.redeliverySeconds;
      return it;
    }
    return null;
  }
  ack(item: Item): boolean {
    const i = this.items.indexOf(item);
    if (i < 0) return false;
    this.items.splice(i, 1);
    return true;
  }
  oldest(now: number): number {
    let age = 0;
    for (const it of this.items) age = Math.max(age, now - it.msg.createdAt);
    return age;
  }
}

function hashEntity(entity: number, shards: number): number {
  return (Math.imul(entity + 1, 2654435761) >>> 0) % shards;
}

export function simulate(scenario: Scenario, integration: Integration): Outcome {
  const { producer, consumers } = scenario;
  // Two generators so the traffic is identical whatever the integration; only service jitter draws from the second.
  const rng = mulberry32(7);
  const jitterRng = mulberry32(11);
  const out: Outcome = { delivered: 0, lost: 0, duplicatesProcessed: 0, suppressedDuplicates: 0, outOfOrder: 0, deadLettered: 0, wastedAttempts: 0, poisonSent: 0, maxBacklog: 0, maxAgeSeconds: 0, drainedAt: null, perSubscriber: {}, ticks: [] };
  const completed = new Set<number>();
  const lastSeq = new Map<number, number>();
  const seqByEntity = new Map<number, number>();
  const queues: Queue[] = [];
  const slots: Slot[] = [];
  const locked = new Set<number>();
  const idempotent = integration.kind === "queue" && integration.idempotent;
  const dropHandler = (reason: "dead-letter" | "lost") => {
    if (reason === "dead-letter") out.deadLettered += 1;
    else out.lost += 1;
  };
  const subNeeds = new Map(scenario.subscribers.map((s) => [s.name, s]));
  const subQueues = new Map<string, Queue>();
  const subConfig = new Map(integration.kind === "topic" ? integration.subscribers.map((s) => [s.name, s]) : []);
  const inOutage = (t: number, sub: string | null) => {
    const o = sub ? subNeeds.get(sub)?.outage : consumers.outage;
    return Boolean(o && t >= o.from && t < o.to);
  };

  if (integration.kind === "queue") {
    const q = new Queue(integration, dropHandler);
    queues.push(q);
    for (let i = 0; i < consumers.count; i++) slots.push({ freeAt: 0, item: null, queue: q, sub: null });
  } else if (integration.kind === "direct") {
    for (let i = 0; i < consumers.count; i++) slots.push({ freeAt: 0, item: null, queue: null, sub: null });
  } else if (integration.kind === "topic") {
    for (const s of scenario.subscribers) {
      out.perSubscriber[s.name] = { wanted: 0, unwanted: 0, lost: 0 };
      const cfg = subConfig.get(s.name);
      const q = cfg?.buffered ? new Queue({ redeliverySeconds: 30, maxReceives: null, deadLetter: false, ordered: false }, dropHandler) : null;
      if (q) {
        queues.push(q);
        subQueues.set(s.name, q);
      }
      for (let i = 0; i < consumers.count; i++) slots.push({ freeAt: 0, item: null, queue: q, sub: s.name });
    }
  } else {
    for (let i = 0; i < integration.shards; i++) {
      const q = new Queue({ redeliverySeconds: 30, maxReceives: null, deadLetter: false, ordered: false }, dropHandler);
      queues.push(q);
      slots.push({ freeAt: 0, item: null, queue: q, sub: null });
    }
  }

  let nextId = 1;
  let acc = 0;
  const pendingDup: Array<{ at: number; msg: Msg }> = [];

  const typeFor = () => {
    let r = rng();
    for (const t of producer.types) {
      if (r < t.share) return t.type;
      r -= t.share;
    }
    return producer.types[producer.types.length - 1]?.type ?? "event";
  };

  const serviceTime = () => consumers.serviceSeconds * (1 + consumers.serviceJitter * (jitterRng() * 2 - 1));

  const complete = (msg: Msg, sub: string | null) => {
    if (sub) {
      const need = subNeeds.get(sub)!;
      if (need.needs.includes(msg.type)) out.perSubscriber[sub].wanted += 1;
      else out.perSubscriber[sub].unwanted += 1;
      out.delivered += 1;
      return;
    }
    if (completed.has(msg.id)) {
      if (idempotent) out.suppressedDuplicates += 1;
      else out.duplicatesProcessed += 1;
      return;
    }
    completed.add(msg.id);
    out.delivered += 1;
    const last = lastSeq.get(msg.entity) ?? -1;
    if (msg.seq < last) out.outOfOrder += 1;
    else lastSeq.set(msg.entity, msg.seq);
  };

  /** A direct call: the producer waits for a consumer; none free within the second, or all down, and the call fails. */
  const deliverDirect = (msg: Msg, t: number, sub: string | null): void => {
    const fail = () => {
      out.lost += 1;
      if (sub) out.perSubscriber[sub].lost += 1;
    };
    if (inOutage(t, sub)) return fail();
    let slot: Slot | null = null;
    for (const s of slots) if (s.sub === sub && !s.item && (!slot || s.freeAt < slot.freeAt)) slot = s;
    if (!slot || Math.max(slot.freeAt, t) >= t + 1) return fail();
    slot.freeAt = Math.max(slot.freeAt, t) + serviceTime();
    if (msg.poison) fail();
    else complete(msg, sub);
  };

  const route = (msg: Msg, t: number) => {
    switch (integration.kind) {
      case "direct":
        deliverDirect(msg, t, null);
        break;
      case "queue":
        queues[0].enqueue(msg, out);
        break;
      case "topic":
        for (const s of scenario.subscribers) {
          const cfg = subConfig.get(s.name);
          if (cfg?.filter && !cfg.filter.includes(msg.type)) continue;
          const q = subQueues.get(s.name);
          if (q) q.enqueue(msg, out);
          else deliverDirect(msg, t, s.name);
        }
        break;
      case "stream": {
        const shard = integration.partitionBy === "entity" ? hashEntity(msg.entity, integration.shards) : hashEntity(msg.id, integration.shards);
        queues[shard].enqueue(msg, out);
        break;
      }
    }
  };

  const horizon = producer.seconds + 600;
  for (let t = 0; t <= horizon; t++) {
    // 1. Produce.
    if (t < producer.seconds) {
      acc += producer.ratePerSec;
      const n = Math.floor(acc);
      acc -= n;
      for (let i = 0; i < n; i++) {
        const entity = rng() < producer.hotEntityShare ? 0 : 1 + Math.floor(rng() * Math.max(1, producer.entities - 1));
        const seq = (seqByEntity.get(entity) ?? 0) + 1;
        seqByEntity.set(entity, seq);
        const poison = rng() < producer.poisonShare;
        if (poison) out.poisonSent += 1;
        const msg: Msg = { id: nextId++, entity, seq, type: typeFor(), poison, createdAt: t };
        route(msg, t);
        if (rng() < producer.duplicateShare) pendingDup.push({ at: t + 1, msg: { ...msg, createdAt: t + 1 } });
      }
    }
    for (let i = pendingDup.length - 1; i >= 0; i--) {
      if (pendingDup[i].at <= t) {
        route(pendingDup[i].msg, t);
        pendingDup.splice(i, 1);
      }
    }

    // 2. Work the tick in time order: a pull at time `now` comes before a completion later than `now`.
    for (let guard = 0; guard < 100000; guard++) {
      let earliest: Slot | null = null;
      for (const s of slots) if (s.item && s.freeAt <= t + 1 && (!earliest || s.freeAt < earliest.freeAt)) earliest = s;
      const minFinish = earliest ? earliest.freeAt : Infinity;
      let pulled = false;
      for (const s of slots) {
        if (s.item || !s.queue) continue;
        const now = Math.max(s.freeAt, t);
        if (now >= t + 1 || now > minFinish || inOutage(t, s.sub)) continue;
        const it = s.queue.pull(now, locked);
        if (!it) continue;
        pulled = true;
        s.item = it;
        if (s.queue.opts.ordered) locked.add(it.msg.entity);
        s.freeAt = now + serviceTime();
      }
      if (pulled) continue;
      if (!earliest) break;
      const it = earliest.item!;
      earliest.item = null;
      locked.delete(it.msg.entity);
      if (it.msg.poison) {
        out.wastedAttempts += 1;
        continue;
      }
      earliest.queue!.ack(it);
      complete(it.msg, earliest.sub);
    }

    // 3. Measure.
    const backlog = queues.reduce((a, q) => a + q.items.length, 0) + slots.filter((s) => s.item).length;
    const age = Math.max(0, ...queues.map((q) => q.oldest(t + 1)));
    out.maxBacklog = Math.max(out.maxBacklog, backlog);
    out.maxAgeSeconds = Math.max(out.maxAgeSeconds, age);
    out.ticks.push({ t, backlog, delivered: out.delivered, lost: out.lost, wasted: out.wastedAttempts });
    if (t >= producer.seconds && pendingDup.length === 0 && backlog === 0) {
      out.drainedAt = t + 1;
      break;
    }
  }
  return out;
}

export function checkMessaging(scenario: Scenario, integration: Integration, req: Requirement): { outcome: Outcome; checks: CheckResult[] } {
  const o = simulate(scenario, integration);
  const checks: CheckResult[] = [
    { id: "lost", label: `At most ${req.maxLost} message${req.maxLost === 1 ? "" : "s"} lost`, passed: o.lost <= req.maxLost, detail: `${o.lost} lost` },
    { id: "duplicates", label: `At most ${req.maxDuplicates} message${req.maxDuplicates === 1 ? "" : "s"} processed twice`, passed: o.duplicatesProcessed <= req.maxDuplicates, detail: `${o.duplicatesProcessed} processed twice${o.suppressedDuplicates ? `, ${o.suppressedDuplicates} duplicate${o.suppressedDuplicates === 1 ? "" : "s"} suppressed` : ""}` },
    { id: "order", label: `At most ${req.maxOutOfOrder} message${req.maxOutOfOrder === 1 ? "" : "s"} out of order within an entity`, passed: o.outOfOrder <= req.maxOutOfOrder, detail: `${o.outOfOrder} out of order` },
    { id: "age", label: `Nothing waits longer than ${req.maxAgeSeconds} s`, passed: o.maxAgeSeconds <= req.maxAgeSeconds, detail: `oldest wait ${o.maxAgeSeconds} s` },
    { id: "drained", label: `Everything processed within ${req.drainWithinSeconds} s`, passed: o.drainedAt !== null && o.drainedAt <= req.drainWithinSeconds, detail: o.drainedAt === null ? "never drained (backlog still growing at the end)" : `drained at ${o.drainedAt} s` },
  ];
  if (req.maxWastedAttempts !== undefined) checks.push({ id: "wasted", label: `At most ${req.maxWastedAttempts} attempts wasted on poison messages`, passed: o.wastedAttempts <= req.maxWastedAttempts, detail: `${o.wastedAttempts} wasted attempts on ${o.poisonSent} poison message${o.poisonSent === 1 ? "" : "s"}` });
  if (req.parkPoison) checks.push({ id: "parked", label: "Every poison message parked in the dead-letter queue, none dropped", passed: o.deadLettered === o.poisonSent && o.poisonSent > 0, detail: `${o.deadLettered} of ${o.poisonSent} parked` });
  for (const s of scenario.subscribers) {
    const p = o.perSubscriber[s.name];
    if (!p) {
      checks.push({ id: `sub-${s.name}`, label: `${s.name} receives ${s.needs.join(" and ")}, nothing else, nothing lost`, passed: false, detail: "needs a topic with this subscriber" });
      continue;
    }
    checks.push({ id: `sub-${s.name}`, label: `${s.name} receives ${s.needs.join(" and ")}, nothing else, nothing lost`, passed: p.unwanted === 0 && p.lost === 0 && p.wanted > 0, detail: `${p.wanted} wanted, ${p.unwanted} noise, ${p.lost} lost` });
  }
  if (req.maxShards !== undefined) checks.push({ id: "shards", label: `At most ${req.maxShards} shards (each one costs)`, passed: integration.kind !== "stream" || integration.shards <= req.maxShards, detail: integration.kind === "stream" ? `${integration.shards} shard${integration.shards === 1 ? "" : "s"}` : "not a stream" });
  return { outcome: o, checks };
}

export function describeIntegration(i: Integration): string {
  switch (i.kind) {
    case "direct":
      return "Direct calls, nothing in between";
    case "queue":
      return `${i.ordered ? "Ordered" : "Standard"} job queue, redelivery after ${i.redeliverySeconds} s, ${i.maxReceives === null ? "unlimited receives" : `${i.maxReceives} receives then ${i.deadLetter ? "dead-letter" : "drop"}`}${i.idempotent ? ", idempotent consumers" : ""}`;
    case "topic":
      return `Pub/sub topic with ${i.subscribers.map((s) => `${s.name} (${s.filter ? s.filter.join(", ") : "everything"}, ${s.buffered ? "buffered" : "direct"})`).join("; ")}`;
    case "stream":
      return `Stream with ${i.shards} shard${i.shards === 1 ? "" : "s"}, partitioned by ${i.partitionBy === "entity" ? "entity" : "nothing (round robin)"}`;
  }
}
