import { describe, expect, it } from "vitest";
import { designMissions } from "../src/content/missions/design";
import { deriveDesign, emptyDesign, evaluateDesign, type DesignState } from "../src/engine/design/evaluate";

const m = designMissions[0];
const ref = (): DesignState => ({ choices: { ...m.referenceDesign.choices }, quantities: { ...m.referenceDesign.quantities }, drills: Object.fromEntries(m.drills.map((d) => [d.id, d.answerFor(m.referenceDesign.choices)])), justification: m.referenceDesign.justification });

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
