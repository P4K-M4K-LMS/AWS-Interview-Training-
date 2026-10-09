import type { Integration, Requirement, Scenario } from "../../engine/messaging/simulate";

/**
 * Messaging exercises. Each fixes a producer, consumers and a requirement and
 * starts from an integration that fails in an instructive way; the learner
 * changes the integration until every check passes. `solution` is the
 * reference the tests run; never shown.
 */
export interface MessagingExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  scenario: Scenario;
  requirement: Requirement;
  start: Integration;
  hints: string[];
  solution: Integration;
}

const producer = (over: Partial<Scenario["producer"]> = {}): Scenario["producer"] => ({ ratePerSec: 20, seconds: 120, duplicateShare: 0, poisonShare: 0, types: [{ type: "order.placed", share: 1 }], entities: 50, hotEntityShare: 0, ...over });
const consumers = (over: Partial<Scenario["consumers"]> = {}): Scenario["consumers"] => ({ count: 4, serviceSeconds: 0.1, serviceJitter: 0, outage: null, ...over });
const queue = (over: Partial<Extract<Integration, { kind: "queue" }>> = {}): Integration => ({ kind: "queue", redeliverySeconds: 30, maxReceives: null, deadLetter: false, ordered: false, idempotent: false, ...over });
const ORDER_TYPES = [
  { type: "order.paid", share: 0.5 },
  { type: "order.shipped", share: 0.3 },
  { type: "order.cancelled", share: 0.2 },
];

export const MESSAGING_EXERCISES: MessagingExercise[] = [
  {
    id: "msg-01-decouple",
    title: "The consumer goes down for thirty seconds",
    brief: "Orders arrive at 20 per second for two minutes and the fulfilment service handles them as direct calls. Between 30 s and 60 s the fulfilment service is being restarted. Lose nothing, and have everything processed within 150 s with no order waiting longer than a minute.",
    teaches: "A direct call couples the producer to the consumer's availability: while the consumer is down the producer has nowhere to put the work. A queue between them holds the backlog, the consumers drain it when they return, and the cost is latency during the outage instead of loss.",
    scenario: { producer: producer(), consumers: consumers({ outage: { from: 30, to: 60 } }), subscribers: [] },
    requirement: { maxLost: 0, maxDuplicates: 0, maxOutOfOrder: 0, maxAgeSeconds: 60, drainWithinSeconds: 150 },
    start: { kind: "direct" },
    hints: ["Every order placed during the restart is lost: there is nothing to hold it.", "A job queue holds the orders; four consumers at 0.1 s each drain 40 per second once they are back, twice the arrival rate.", "Job queue; the defaults are fine for a good-natured producer."],
    solution: queue(),
  },
  {
    id: "msg-02-poison",
    title: "Three poison messages eat the queue",
    brief: "Two slow consumers (0.5 s each) handle 3 messages per second for 100 s through a queue. Two percent of messages are malformed and fail every time. The queue redelivers after 5 s and never gives up, so the poison messages come back forever and the backlog grows. Park the poison messages after three attempts without dropping any, waste at most 40 attempts on them, and drain within 130 s.",
    teaches: "A message that fails every time is redelivered every time; each attempt is consumer capacity that good messages do not get. A receive limit with a dead-letter queue parks it after a few attempts for a human to look at. A receive limit without a dead-letter queue just throws it away.",
    scenario: { producer: producer({ ratePerSec: 3, seconds: 100, poisonShare: 0.02 }), consumers: consumers({ count: 2, serviceSeconds: 0.5 }), subscribers: [] },
    requirement: { maxLost: 0, maxDuplicates: 0, maxOutOfOrder: 0, maxAgeSeconds: 60, drainWithinSeconds: 130, maxWastedAttempts: 40, parkPoison: true },
    start: queue({ redeliverySeconds: 5 }),
    hints: ["Watch the wasted attempts climb: each poison message is retried every 5 s for the whole run.", "A receive limit of 3 stops the retries; what happens to the message afterwards depends on the dead-letter setting.", "Standard queue, redelivery 5 s, 3 receives, dead-letter queue on."],
    solution: queue({ redeliverySeconds: 5, maxReceives: 3, deadLetter: true }),
  },
  {
    id: "msg-03-redelivery",
    title: "Redelivered while still being processed",
    brief: "Reports take 2 s each to render. Three renderers pull from a queue that redelivers a message 1 s after it was received, so a report still being rendered is handed to a second renderer. One message per second for 60 s; render nothing twice, lose nothing, drain within 80 s.",
    teaches: "The redelivery delay is a promise about how long processing takes. Shorter than the real service time, every message is processed at least twice; much longer, a crashed consumer's message waits that long before anyone else can take it.",
    scenario: { producer: producer({ ratePerSec: 1, seconds: 60 }), consumers: consumers({ count: 3, serviceSeconds: 2 }), subscribers: [] },
    requirement: { maxLost: 0, maxDuplicates: 0, maxOutOfOrder: 0, maxAgeSeconds: 10, drainWithinSeconds: 80 },
    start: queue({ redeliverySeconds: 1 }),
    hints: ["Every report is processed twice: a second renderer receives it 1 s in, while the first is still rendering.", "Set the redelivery delay longer than the longest render; a few times the service time is the usual rule.", "Redelivery 10 s (anything from 3 s up passes here)."],
    solution: queue({ redeliverySeconds: 10 }),
  },
  {
    id: "msg-04-order",
    title: "A ledger needs every account in order, once",
    brief: "Account movements arrive at 10 per second for 60 s; the producer retries on a lost acknowledgement, so 5% arrive twice. Four consumers process in parallel with uneven timing, so two movements of the same account can finish in the wrong order. Process every movement exactly once and in order per account; drain within 90 s.",
    teaches: "Parallel consumers and producer retries break both guarantees a ledger needs. An ordered queue locks one group (here: one account) to one consumer at a time and suppresses duplicates by message id; an idempotent consumer fixes the duplicates but not the order.",
    scenario: { producer: producer({ ratePerSec: 10, seconds: 60, duplicateShare: 0.05, entities: 40, hotEntityShare: 0.1 }), consumers: consumers({ count: 4, serviceSeconds: 0.2, serviceJitter: 0.5 }), subscribers: [] },
    requirement: { maxLost: 0, maxDuplicates: 0, maxOutOfOrder: 0, maxAgeSeconds: 10, drainWithinSeconds: 90 },
    start: queue(),
    hints: ["Two problems: the 5% duplicates are processed twice, and movements of the same account overtake each other.", "Idempotent consumers handle the duplicates. Order needs the queue to hold back a second movement of an account while the first is in flight.", "Ordered queue (per-group locking with duplicate suppression); idempotent consumers are a fine belt to its braces."],
    solution: queue({ ordered: true }),
  },
  {
    id: "msg-05-fanout",
    title: "Three subscribers, three interests",
    brief: "Order events (paid, shipped, cancelled) are published at 10 per second for 60 s. Billing needs order.paid, shipping needs order.shipped, audit needs everything. The topic currently sends everything to everyone as direct calls, and shipping is restarted between 20 s and 40 s. Give each subscriber only what it needs, lose nothing, and drain within 80 s.",
    teaches: "A topic fans one message out to many subscribers; a subscription filter drops the types a subscriber does not want before they are delivered, so the subscriber neither pays for nor has to ignore them. A buffered subscription (a queue behind the topic) is what survives a subscriber's outage.",
    scenario: {
      producer: producer({ ratePerSec: 10, seconds: 60, types: ORDER_TYPES }),
      consumers: consumers({ count: 2, serviceSeconds: 0.1 }),
      subscribers: [
        { name: "billing", needs: ["order.paid"], outage: null },
        { name: "shipping", needs: ["order.shipped"], outage: { from: 20, to: 40 } },
        { name: "audit", needs: ["order.paid", "order.shipped", "order.cancelled"], outage: null },
      ],
    },
    requirement: { maxLost: 0, maxDuplicates: 0, maxOutOfOrder: 0, maxAgeSeconds: 30, drainWithinSeconds: 80 },
    start: {
      kind: "topic",
      subscribers: [
        { name: "billing", filter: null, buffered: false },
        { name: "shipping", filter: null, buffered: false },
        { name: "audit", filter: null, buffered: false },
      ],
    },
    hints: ["Billing is receiving shipped and cancelled events it does not need, and shipping lost everything during its restart.", "A filter per subscription; a buffered subscription for anything that can be down.", "billing: order.paid, buffered; shipping: order.shipped, buffered; audit: everything, buffered."],
    solution: {
      kind: "topic",
      subscribers: [
        { name: "billing", filter: ["order.paid"], buffered: true },
        { name: "shipping", filter: ["order.shipped"], buffered: true },
        { name: "audit", filter: null, buffered: true },
      ],
    },
  },
  {
    id: "msg-06-stream",
    title: "A hot customer on a partitioned stream",
    brief: "Position updates arrive at 20 per second for 60 s; one customer sends 40% of them. A stream consumer handles 10 per second per shard, in order within the shard. The single shard cannot keep up. Keep every customer's updates in order, let nothing wait longer than 5 s, drain within 70 s, and use no more than 8 shards.",
    teaches: "A stream scales by shards, and order is kept only within a shard, so the partition key decides what stays ordered: by entity, every customer's updates land on one shard. The hottest key then sets the minimum per-shard capacity, and adding shards only spreads the rest.",
    scenario: { producer: producer({ ratePerSec: 20, seconds: 60, entities: 20, hotEntityShare: 0.4 }), consumers: consumers({ count: 1, serviceSeconds: 0.1 }), subscribers: [] },
    requirement: { maxLost: 0, maxDuplicates: 0, maxOutOfOrder: 0, maxAgeSeconds: 5, drainWithinSeconds: 70, maxShards: 8 },
    start: { kind: "stream", shards: 1, partitionBy: "random" },
    hints: ["Four shards partitioned by nothing keep up, and the hot customer's updates are spread across all four, so they finish out of order.", "Partition by entity: the hot customer's 8 per second all land on one shard, which also carries its share of the other 12 per second.", "Entity partitioning with 8 shards: the hot shard carries 8 + 12/8 = 9.5 per second, under the 10 it can handle."],
    solution: { kind: "stream", shards: 8, partitionBy: "entity" },
  },
];

export const MESSAGING_EXERCISE_BY_ID = new Map(MESSAGING_EXERCISES.map((e) => [e.id, e]));
