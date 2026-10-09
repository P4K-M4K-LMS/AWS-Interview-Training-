import { describe, expect, it } from "vitest";
import { designMissions } from "../src/content/missions/design";
import { deriveDesign, emptyDesign, evaluateDesign, type DesignState } from "../src/engine/design/evaluate";

const m = designMissions[0];
const refFor = (mission: (typeof designMissions)[number]): DesignState => ({ choices: { ...mission.referenceDesign.choices }, quantities: { ...mission.referenceDesign.quantities }, drills: Object.fromEntries(mission.drills.map((d) => [d.id, d.answerFor(mission.referenceDesign.choices)])), justification: mission.referenceDesign.justification });
const ref = (): DesignState => refFor(m);

describe("every design exercise", () => {
  it("starts unsolved, and its reference design passes every check", () => {
    expect(designMissions.length).toBe(2);
    for (const mission of designMissions) {
      expect(evaluateDesign(mission, emptyDesign()).checks.every((c) => !c.passed), mission.id).toBe(true);
      for (const c of evaluateDesign(mission, refFor(mission)).checks) expect(c.passed, `${mission.id} ${c.id}: ${c.detail ?? ""}`).toBe(true);
      for (const slot of mission.slots) expect(new Set(slot.options.map((o) => o.id)).size, `${mission.id}/${slot.id}`).toBe(slot.options.length);
      for (const q of mission.quantities) expect(q.min).toBeLessThanOrEqual(q.max);
      for (const d of mission.drills) expect(d.answerFor(mission.referenceDesign.choices)).toBeLessThan(d.options.length);
    }
  });
});

describe("command and acknowledgement exercise (design-02)", () => {
  const d2 = designMissions[1];
  const base = () => refFor(d2);
  const check = (s: DesignState, id: string) => evaluateDesign(d2, s).checks.find((c) => c.id === id)!;

  it("requires strong consistency on the read path and names what breaks it", () => {
    const r = evaluateDesign(d2, base());
    expect(r.derived.cost).toBe(1110);
    expect(r.derived.readLatencyMs).toBe(70);
    expect(r.derived.readConsistency).toBe("strong");
    expect(r.checks.map((c) => c.id)).toContain("consistency");
    expect(r.checks.find((c) => c.id === "throughput")?.label).toMatch(/300 commands\/s/);
    expect(r.checks.find((c) => c.id === "durable")?.label).toMatch(/gateway outage/);
    const cached = { ...base(), choices: { ...base().choices, read: "cache" } };
    expect(check(cached, "consistency").passed).toBe(false);
    expect(check(cached, "consistency").detail).toMatch(/Cache in front/);
    expect(check(cached, "latency").passed).toBe(true);
    const kv = { ...base(), choices: { ...base().choices, store: "kv-store" } };
    expect(check(kv, "consistency").passed).toBe(false);
    expect(check(kv, "budget").passed).toBe(true);
  });

  it("needs no single point of failure on both paths, a durable buffer, and the budget forces the function", () => {
    const single = { ...base(), choices: { ...base().choices, store: "single-db" } };
    expect(check(single, "spof-write").passed).toBe(false);
    expect(check(single, "spof-read").passed).toBe(false);
    const direct = { ...base(), choices: { ...base().choices, buffer: "direct" } };
    expect(check(direct, "durable").passed).toBe(false);
    const containers = { ...base(), choices: { ...base().choices, api: "containers" } };
    expect(check(containers, "budget").passed).toBe(false);
    expect(check(containers, "budget").detail).toMatch(/1,460|1460/);
  });

  it("drills follow the design, including the duplicate-prevention slot", () => {
    const c = base().choices;
    const drill = (id: string) => d2.drills.find((d) => d.id === id)!;
    expect(drill("double-send").answerFor(c)).toBe(0);
    expect(drill("double-send").answerFor({ ...c, dedup: "button" })).toBe(1);
    expect(drill("double-send").answerFor({ ...c, dedup: "none" })).toBe(2);
    expect(drill("status-after-failover").answerFor(c)).toBe(0);
    expect(drill("status-after-failover").answerFor({ ...c, read: "replica" })).toBe(1);
    expect(drill("status-after-failover").answerFor({ ...c, store: "kv-store" })).toBe(3);
    expect(drill("status-after-failover").answerFor({ ...c, store: "single-db" })).toBe(2);
    expect(drill("gateway-outage").answerFor({ ...c, buffer: "memory-broker" })).toBe(2);
    expect(check({ ...base(), quantities: { ...base().quantities, "ack-timeout": 3 } }, "qty-ack-timeout").passed).toBe(false);
    expect(check({ ...base(), quantities: { ...base().quantities, "idempotency-retention": 5 } }, "qty-idempotency-retention").passed).toBe(false);
    expect(check({ ...base(), quantities: { ...base().quantities, workers: 30 } }, "qty-workers").passed).toBe(true);
  });
});

describe("design exercise rubric", () => {
  it("starts unsolved and the reference design passes every check", () => {
    const empty = evaluateDesign(m, emptyDesign());
    expect(empty.checks.every((c) => !c.passed)).toBe(true);
    const r = evaluateDesign(m, ref());
    for (const c of r.checks) expect(c.passed, `${c.id}: ${c.detail ?? ""}`).toBe(true);
    expect(r.derived.cost).toBe(820);
    expect(r.derived.readLatencyMs).toBe(25);
    expect(r.derived.spofs).toEqual([]);
  });

  it("every option is reachable and every slot has at least one option that can satisfy the requirements", () => {
    for (const slot of m.slots) {
      expect(slot.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(slot.options.map((o) => o.id)).size).toBe(slot.options.length);
    }
    for (const q of m.quantities) expect(q.min).toBeLessThanOrEqual(q.max);
    for (const d of m.drills) expect(d.answerFor(m.referenceDesign.choices)).toBeLessThan(d.options.length);
  });

  it("rejects designs that break one requirement each, naming the reason", () => {
    const base = ref();
    const fail = (patch: Record<string, string>, id: string, detail: RegExp) => {
      const s = { ...base, choices: { ...base.choices, ...patch } };
      const c = evaluateDesign(m, s).checks.find((x) => x.id === id)!;
      expect(c.passed, id).toBe(false);
      expect(c.detail ?? "").toMatch(detail);
    };
    fail({ ingest: "vm" }, "throughput", /capacity 800/);
    fail({ ingest: "vm" }, "spof-write", /Single VM/);
    fail({ buffer: "direct" }, "durable", /nothing holds events/);
    fail({ buffer: "memory-broker" }, "spof-write", /In-memory broker/);
    fail({ storage: "single-db" }, "spof-write", /Single-node/);
    fail({ read: "direct-read", storage: "managed-db" }, "latency", /160 ms/);
    const pricey = { ...base, choices: { ingest: "containers", buffer: "durable-queue", storage: "managed-db", read: "replica" } };
    const budget = evaluateDesign(m, pricey).checks.find((c) => c.id === "budget")!;
    expect(budget.passed).toBe(false);
    expect(budget.detail).toMatch(/1,790|1790/);
  });

  it("drill answers follow the design, sizing has ranges, and the justification check is structural", () => {
    const s = ref();
    const withDirect = { ...s, choices: { ...s.choices, buffer: "direct" } };
    expect(m.drills[0].answerFor(withDirect.choices)).toBe(1);
    expect(evaluateDesign(m, withDirect).checks.find((c) => c.id === "drill-storage-outage")?.passed).toBe(false);
    const replica = { ...s, choices: { ...s.choices, read: "replica" }, drills: { ...s.drills, "primary-failover": 2 } };
    expect(evaluateDesign(m, replica).checks.find((c) => c.id === "drill-primary-failover")?.passed).toBe(true);
    expect(evaluateDesign(m, { ...s, quantities: { ...s.quantities, concurrency: 200 } }).checks.find((c) => c.id === "qty-concurrency")?.passed).toBe(false);
    expect(evaluateDesign(m, { ...s, quantities: { ...s.quantities, consumers: 120 } }).checks.find((c) => c.id === "qty-consumers")?.passed).toBe(true);
    const short = evaluateDesign(m, { ...s, justification: "function queue cost latency failure" }).checks.find((c) => c.id === "justification")!;
    expect(short.passed).toBe(false);
    expect(short.detail).toMatch(/chars/);
    const noTerms = evaluateDesign(m, { ...s, justification: "I chose the function, the durable queue, the key-value store and the cache because they are the best options available for the fleet tracking platform and the dispatcher map in my opinion." }).checks.find((c) => c.id === "justification")!;
    expect(noTerms.passed).toBe(false);
    const derived = deriveDesign(m, emptyDesign());
    expect(derived.complete).toBe(false);
    expect(derived.ingestCapacity).toBe(0);
  });
});
