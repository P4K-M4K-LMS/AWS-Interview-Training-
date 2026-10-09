import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { MESSAGING_EXERCISES, MESSAGING_EXERCISE_BY_ID } from "../src/content/study/messagingExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { checkMessaging, simulate, type Integration, type Scenario } from "../src/engine/messaging/simulate";
import { creditLabExercise } from "../src/engine/study/bridge";

const ex = (id: string) => MESSAGING_EXERCISE_BY_ID.get(id)!;
const failing = (scenario: Scenario, integration: Integration, id: string) =>
  checkMessaging(scenario, integration, ex(id).requirement)
    .checks.filter((c) => !c.passed)
    .map((c) => c.id);

describe("messaging simulation", () => {
  it("direct calls lose everything sent during an outage; a queue holds it and drains at the consumers' rate", () => {
    const e = ex("msg-01-decouple");
    const direct = simulate(e.scenario, { kind: "direct" });
    expect(direct.lost).toBe(600); // 20/s for the 30 s outage
    expect(direct.delivered).toBe(1800);
    const q = simulate(e.scenario, e.solution);
    expect(q.lost).toBe(0);
    expect(q.delivered).toBe(2400);
    expect(q.maxBacklog).toBe(600);
    expect(q.maxAgeSeconds).toBe(30);
    expect(q.drainedAt).toBe(121);
  });

  it("the same traffic is produced whatever the integration", () => {
    const e = ex("msg-02-poison");
    const a = simulate(e.scenario, e.start);
    const b = simulate(e.scenario, e.solution);
    expect(a.poisonSent).toBe(b.poisonSent);
    expect(a.poisonSent).toBe(11);
  });

  it("poison messages without a receive limit are retried forever and starve the queue; a limit with a dead-letter queue parks them", () => {
    const e = ex("msg-02-poison");
    const forever = simulate(e.scenario, e.start);
    expect(forever.drainedAt).toBeNull();
    expect(forever.wastedAttempts).toBeGreaterThan(1000);
    expect(forever.deadLettered).toBe(0);
    const parked = simulate(e.scenario, e.solution);
    expect(parked.deadLettered).toBe(11);
    expect(parked.wastedAttempts).toBe(33);
    expect(parked.lost).toBe(0);
    expect(parked.drainedAt).not.toBeNull();
    // A limit without a dead-letter queue drops them: lost, not parked.
    expect(failing(e.scenario, { ...(e.start as Extract<Integration, { kind: "queue" }>), maxReceives: 3 }, "msg-02-poison")).toEqual(["lost", "parked"]);
  });

  it("a redelivery delay shorter than the service time processes messages twice", () => {
    const e = ex("msg-03-redelivery");
    const short = simulate(e.scenario, e.start);
    expect(short.duplicatesProcessed).toBeGreaterThan(20);
    expect(short.delivered).toBe(60);
    for (const d of [2, 3, 10]) expect(simulate(e.scenario, { ...(e.start as Extract<Integration, { kind: "queue" }>), redeliverySeconds: d }).duplicatesProcessed, `redelivery ${d}`).toBe(0);
  });

  it("producer retries and parallel consumers break exactly-once and order; idempotent consumers fix one, an ordered queue both", () => {
    const e = ex("msg-04-order");
    const std = simulate(e.scenario, e.start);
    expect(std.duplicatesProcessed).toBeGreaterThan(0);
    expect(std.outOfOrder).toBeGreaterThan(0);
    const idem = simulate(e.scenario, { ...(e.start as Extract<Integration, { kind: "queue" }>), idempotent: true });
    expect(idem.duplicatesProcessed).toBe(0);
    expect(idem.suppressedDuplicates).toBeGreaterThan(0);
    expect(idem.outOfOrder).toBeGreaterThan(0);
    const ordered = simulate(e.scenario, e.solution);
    expect(ordered.duplicatesProcessed).toBe(0);
    expect(ordered.outOfOrder).toBe(0);
    expect(ordered.suppressedDuplicates).toBe(std.duplicatesProcessed);
    expect(ordered.delivered).toBe(600);
  });

  it("a topic delivers noise without filters and loses an unbuffered subscriber's outage; filters and buffers fix both", () => {
    const e = ex("msg-05-fanout");
    const start = simulate(e.scenario, e.start);
    expect(start.perSubscriber.billing.unwanted).toBe(300);
    expect(start.perSubscriber.shipping.lost).toBe(200);
    expect(start.perSubscriber.audit.unwanted).toBe(0);
    const sol = simulate(e.scenario, e.solution);
    for (const s of ["billing", "shipping", "audit"]) {
      expect(sol.perSubscriber[s].unwanted, s).toBe(0);
      expect(sol.perSubscriber[s].lost, s).toBe(0);
    }
    expect(sol.perSubscriber.audit.wanted).toBe(600);
    expect(sol.perSubscriber.billing.wanted + sol.perSubscriber.shipping.wanted).toBeLessThan(600);
    expect(sol.maxAgeSeconds).toBe(20); // shipping's buffered backlog during its outage
  });

  it("a stream keeps order only within a shard; the partition key and the hot key set the shard count", () => {
    const e = ex("msg-06-stream");
    expect(failing(e.scenario, e.start, "msg-06-stream")).toEqual(["age", "drained"]);
    expect(failing(e.scenario, { kind: "stream", shards: 4, partitionBy: "random" }, "msg-06-stream")).toEqual(["order"]);
    expect(failing(e.scenario, { kind: "stream", shards: 4, partitionBy: "entity" }, "msg-06-stream")).toEqual(["age"]);
    expect(failing(e.scenario, { kind: "stream", shards: 16, partitionBy: "entity" }, "msg-06-stream")).toEqual(["shards"]);
    expect(failing(e.scenario, e.solution, "msg-06-stream")).toEqual([]);
  });
});

describe("messaging lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and passes with its reference integration", () => {
    for (const e of MESSAGING_EXERCISES) {
      const start = checkMessaging(e.scenario, e.start, e.requirement);
      expect(start.checks.every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const sol = checkMessaging(e.scenario, e.solution, e.requirement);
      expect(sol.checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`), e.id).toEqual([]);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of MESSAGING_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("msg-01-decouple", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["msg-01-decouple"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["msg-01-decouple"].length);
  });

  it("exercise text stays vendor-neutral", () => {
    const text = JSON.stringify(MESSAGING_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "SQS", "SNS", "Kinesis", "EventBridge", "FIFO"]) expect(text, word).not.toContain(word);
  });
});
