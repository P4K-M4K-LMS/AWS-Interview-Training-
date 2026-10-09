import type { DesignMission } from "../../domain/types";

/**
 * Design exercises: requirements in, a justified design out, checked by a
 * transparent rubric (src/engine/design/evaluate.ts). Every number below is
 * fictional and chosen for the arithmetic to be clear; the options model
 * generic infrastructure, not any vendor's products.
 */
const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are asked to design the next version of one of its systems before anyone writes code.";

export const designMissions: DesignMission[] = [
  {
    id: "design-01-position-ingest",
    kind: "design",
    trackId: "serverless",
    stage: 6,
    title: "Design exercise: the vehicle-position ingest and map read path",
    summary: "Choose components for a 2,000 events/s ingest and a sub-100 ms map read, size the function and the queue consumers, predict failure behaviour from your own design, and justify the tradeoffs.",
    briefing: `${COMPANY_INTRO}\n\nThe current ingest is a single VM writing straight into one database. It falls over at 800 events/s, loses positions whenever the database restarts, and the dispatcher map reads straight from the primary. Design the replacement within budget. Every choice has a cost, a capacity, a latency and a failure mode; the rubric computes the consequences of your choices and checks them against the requirements.`,
    objectives: [
      "Pick an ingest, a buffer, a storage and a read-path component that together sustain 2,000 events/s, keep map reads under 100 ms, cost at most 1,500 per month, have no single point of failure on the write path, and never lose events during a storage outage",
      "Size the ingest function's concurrency and the queue consumers from the numbers given",
      "Answer two failure drills whose correct answers depend on the components you chose",
      "Justify the design: name your components and the tradeoffs (cost, latency, consistency, failure)",
    ],
    skills: ["distributed.architecture", "distributed.scaling", "serverless.scaling", "serverless.events"],
    prerequisites: ["serverless-02-poison-messages"],
    estimatedMinutes: 30,
    lesson: [
      {
        title: "Requirements first, components second",
        body: "A design is a set of tradeoffs chosen against explicit requirements. Write the numbers down before picking anything: peak load (events/s), latency budget (ms at p95), money (per month), availability (which paths may not have a single point of failure) and durability (what may never be lost). Then pick the cheapest set of components that meets every number. A component that is 'better' on a dimension the requirements do not mention is just more expensive.",
      },
      {
        title: "Capacity arithmetic you will be asked for",
        body: "Function concurrency = events/s × duration in seconds (2,000 × 0.15 = 300). Queue consumers = events/s ÷ throughput per consumer, with headroom (2,000 ÷ 25 = 80; plan for more than 80 so the backlog shrinks). Read latency on a path is roughly the sum of the hops. Cost is a sum. Say the arithmetic out loud in interviews: it is the part that shows you have run systems, not just drawn them.",
      },
      {
        title: "Failure drills: reason from the design you drew",
        body: "For each component ask: what happens to the write path and to the read path if this one disappears? A durable queue in front of storage means a storage outage delays writes instead of losing them. A read replica or a cache means a primary failover is invisible to readers (at the cost of staleness). A single VM or a single-node broker is a single point of failure whatever sits around it.",
      },
    ],
    glossary: [
      { term: "single point of failure (SPOF)", definition: "A component whose failure stops the whole path through it." },
      { term: "durable buffer", definition: "A queue or log that persists events until a consumer confirms them, so downstream outages delay rather than lose work." },
      { term: "p95 latency budget", definition: "The slowest acceptable response for 95% of requests, summed across the hops on the path." },
      { term: "eventual consistency", definition: "Readers may briefly see older data; acceptable for a map, not for a bank balance." },
      { term: "tradeoff", definition: "Choosing which requirement to favour when two conflict (cost vs latency, consistency vs availability)." },
    ],
    hints: [
      { level: 1, title: "Eliminate by requirement", body: "Anything marked as a single point of failure cannot sit on the write path. Anything with capacity below 2,000/s cannot be the ingest. Add up costs as you go: the budget is 1,500, so the all-managed, all-relational design (about 1,790) does not fit." },
      { level: 2, title: "The buffer is the durability answer", body: "'Never lose events during a storage outage' means something durable must hold events between ingest and storage. The in-memory broker loses them on restart; writing directly to storage loses them while storage is down." },
      { level: 3, title: "Arithmetic", body: "Concurrency: 2,000 × 0.15 s = 300. Consumers: 2,000 ÷ 25 = 80, so answer 80 or more (up to 120 keeps cost sane). Read latency: add the read-path option's latency to the storage latency." },
      { level: 4, title: "Guided example", body: "Function behind an API gateway (capacity 10,000/s, 400) + durable queue (90) + managed key-value store with replication (250) + cache in front (80) = 820 per month, no SPOF on the write path, read 15 + 10 = 25 ms. Concurrency 300, consumers 100, DLQ receive count 3. Drill 1: with a durable queue, a storage outage buffers events and applies them after recovery. Drill 2: with a cache, readers keep seeing cached positions during a storage failover. Justification: name the four components and discuss cost, latency, consistency and failure." },
    ],
    reflectionPrompts: ["Walk me through your design: the requirements, the components you chose, the arithmetic behind the numbers, and the one tradeoff you would revisit if the budget doubled."],
    transferNote: "This is the shape of a system-design interview: requirements, components, arithmetic, failure modes, tradeoffs. The rubric here checks the structure and the numbers; the story you tell about it is what the interview assesses.",
    requirements: {
      functional: ["Accept vehicle position events from 5,000 vehicles reporting every 2-3 seconds (peak 2,000 events/s)", "Serve the dispatcher map's 'latest position per vehicle' reads", "Positions must never be lost, including during a storage outage or failover"],
      peakIngestPerSec: 2000,
      maxReadLatencyMs: 100,
      budget: 1500,
      noSpofOn: ["write"],
      durableWrites: true,
      justificationTerms: ["cost", "latency", "consistency", "failure", "scale"],
      justificationMinTerms: 3,
      justificationMinChars: 160,
    },
    slots: [
      {
        id: "ingest",
        label: "Ingest",
        prompt: "What receives position events from the vehicles?",
        paths: ["write"],
        options: [
          { id: "vm", name: "Single VM running the API", description: "One instance, manually sized. Cheap and familiar; stops at ~800 events/s and is a single point of failure.", cost: 120, capacity: 800, spof: true },
          { id: "containers", name: "Autoscaled containers behind a load balancer", description: "Several instances, scaled on CPU. Sustains ~5,000 events/s; the load balancer and instance group are replicated.", cost: 650, capacity: 5000 },
          { id: "function", name: "Function behind an API gateway", description: "Scales per request up to its concurrency limit; pay per invocation (about 400/month at this load). Cold starts on bursts unless provisioned.", cost: 400, capacity: 10000 },
        ],
      },
      {
        id: "buffer",
        label: "Buffer between ingest and storage",
        prompt: "What holds events between ingest and storage?",
        paths: ["write"],
        options: [
          { id: "direct", name: "None: write directly to storage", description: "Simplest. Every storage hiccup becomes a failed or lost write.", cost: 0, capacity: 10000 },
          { id: "memory-broker", name: "In-memory broker on one node", description: "Fast, but one node: events in memory are lost on restart and the node is a single point of failure.", cost: 60, capacity: 10000, spof: true },
          { id: "durable-queue", name: "Durable replicated queue", description: "Persists events until consumers acknowledge them; replicated across zones. Adds a few ms.", cost: 90, capacity: 20000, durable: true },
        ],
      },
      {
        id: "storage",
        label: "Position storage",
        prompt: "Where is the latest position per vehicle stored?",
        paths: ["write", "read"],
        options: [
          { id: "single-db", name: "Single-node relational database", description: "Strong consistency, 40 ms reads, one node: a single point of failure.", cost: 300, capacity: 3000, latencyMs: 40, spof: true, consistency: "strong" },
          { id: "managed-db", name: "Managed relational database with standby", description: "Strong consistency, automatic failover to a standby, 40 ms reads.", cost: 700, capacity: 3000, latencyMs: 40, consistency: "strong" },
          { id: "kv-store", name: "Managed key-value store (replicated)", description: "Eventually consistent, replicated across zones, 10 ms reads, scales with writes.", cost: 250, capacity: 50000, latencyMs: 10, consistency: "eventual" },
        ],
      },
      {
        id: "read",
        label: "Map read path",
        prompt: "How does the dispatcher map read positions?",
        paths: ["read"],
        options: [
          { id: "direct-read", name: "Read storage directly", description: "Every map refresh hits storage with a latest-per-vehicle query: ~120 ms under load, on top of the storage read.", cost: 0, latencyMs: 120 },
          { id: "cache", name: "Cache in front of storage", description: "Latest positions served from memory, ~15 ms; a few seconds stale by design.", cost: 80, latencyMs: 15 },
          { id: "replica", name: "Read replica", description: "A replicated copy serving reads, ~60 ms; lags the primary slightly.", cost: 350, latencyMs: 60 },
        ],
      },
    ],
    quantities: [
      { id: "concurrency", label: "Function concurrency limit for 2,000 events/s at 150 ms", prompt: "If the ingest is a function with an average duration of 150 ms, what concurrency limit does 2,000 events/s need? (rate × duration)", unit: "concurrent executions", min: 300, max: 450, explanation: "2,000 × 0.15 s = 300; up to 50% headroom is reasonable." },
      { id: "consumers", label: "Queue consumers to drain 2,000 events/s at 25 events/s each", prompt: "Each consumer processes 25 events/s. How many consumers keep up with 2,000 events/s, with headroom so a backlog shrinks?", unit: "consumers", min: 80, max: 160, explanation: "2,000 ÷ 25 = 80 is break-even; 100-120 gives headroom. More than 160 is paying for idle capacity." },
      { id: "dlq", label: "Dead-letter queue max receive count", prompt: "After how many failed attempts should a message move to the dead-letter queue?", unit: "attempts", min: 2, max: 5, explanation: "1 sends every transient failure to the DLQ; above 5 lets poison messages burn capacity for too long." },
    ],
    drills: [
      {
        id: "storage-outage",
        prompt: "The position storage is unavailable for 4 minutes. With your design, what happens to incoming position events?",
        options: ["They are buffered durably and applied once storage is back; nothing is lost", "They are rejected or lost until storage recovers", "They are held in the broker's memory and lost if the broker restarts", "They are written to the read cache instead"],
        answerFor: (c) => (c.buffer === "durable-queue" ? 0 : c.buffer === "memory-broker" ? 2 : 1),
        explanation: "Only a durable queue holds events across a storage outage. Direct writes fail; an in-memory broker holds them until it restarts.",
      },
      {
        id: "primary-failover",
        prompt: "The storage primary fails over (30 seconds). With your design, what do dispatchers see on the map?",
        options: ["Cached positions keep being served; they are a few seconds stale until writes resume", "The map errors for the whole failover because every read hits storage", "The replica keeps serving slightly stale positions", "The map shows an empty fleet"],
        answerFor: (c) => (c.read === "cache" ? 0 : c.read === "replica" ? 2 : 1),
        explanation: "A cache or a replica keeps serving reads during a failover, at the cost of staleness. Reading storage directly means every read fails until the new primary is up.",
      },
    ],
    referenceDesign: {
      choices: { ingest: "function", buffer: "durable-queue", storage: "kv-store", read: "cache" },
      quantities: { concurrency: 300, consumers: 100, dlq: 3 },
      justification:
        "Ingest with a function behind an API gateway: it scales with the 2,000 events/s peak at a cost of about 400 and has no single point of failure. A durable replicated queue sits between ingest and storage so a storage failure delays writes rather than losing them. The managed key-value store is eventually consistent, which the map tolerates, and its 10 ms reads plus a 15 ms cache keep latency far under budget while total cost stays near 820.",
    },
  },
];
