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
  {
    id: "design-02-command-ack",
    kind: "design",
    trackId: "serverless",
    stage: 6,
    title: "Design exercise: the dispatcher command and acknowledgement path",
    summary: "Design the path that carries a dispatcher's command to a vehicle and its acknowledgement back: 300 commands/s at peak, strongly consistent status reads under 200 ms, no single point of failure on either path, no lost commands during a gateway outage, and no double-sends when a browser retries.",
    briefing: `${COMPANY_INTRO}\n\nDispatchers send commands to vehicles (reroute, hold, return to depot) and watch each one move from pending to delivered to acknowledged. Today a single VM writes commands into one database and the vehicle gateway polls it. During a storm re-route 300 commands/s arrive, the gateway drops out for minutes at a time, and twice this month a vehicle received the same reroute twice because a dispatcher's browser retried a timed-out request. Status must never go backwards on a dispatcher's screen: a command shown as acknowledged may not later read as pending. Design the replacement within budget. The rubric computes cost, capacity, latency, consistency and failure modes from your choices.`,
    objectives: [
      "Pick a command API, a buffer, a store, a status read path and a duplicate-prevention approach that sustain 300 commands/s, keep status reads strongly consistent and under 200 ms, cost at most 1,200 per month, have no single point of failure on the write or the read path, and never lose commands while the vehicle gateway is down",
      "Size the command function's concurrency, the gateway workers, the acknowledgement timeout and how long idempotency records must be kept",
      "Answer three failure drills whose correct answers depend on the components you chose",
      "Justify the design: name your components and the tradeoffs (cost, latency, consistency, failure, idempotency)",
    ],
    skills: ["distributed.architecture", "distributed.consistency", "distributed.resilience", "serverless.idempotency"],
    prerequisites: ["design-01-position-ingest"],
    estimatedMinutes: 30,
    lesson: [
      {
        title: "Consistency is a requirement, not a flavour",
        body: "The position map tolerated stale data because a position a few seconds old is still useful. A command's status does not: a dispatcher who sees 'acknowledged' and then 'pending' will send the command again. **Strong consistency** means every read returns the latest committed write; **eventual consistency** means a read may return an older value for a while. Caches and read replicas are eventually consistent by construction, however fast they are, so they are the wrong answer here even though they were the right answer last time. The requirements decide, not the component's reputation.",
      },
      {
        title: "Idempotency at the edge, timeouts in the middle",
        body: "A browser or a vehicle that times out will retry. If the API applies every request it receives, a retry becomes a duplicate command. An **idempotency key** (the client generates it once per command and sends it with every retry) lets the API recognise the repeat and return the stored result instead of acting again. Disabling a button prevents a double click, not a network retry. The record has to live at least as long as clients can retry.\n\nTimeouts need a budget too: an acknowledgement timeout shorter than the gateway's slowest normal delivery produces false retries; one longer than the dispatcher's patience produces manual re-sends. Pick a value between the two and say why.",
      },
      {
        title: "Both paths matter when people work around the clock",
        body: "Last exercise only the write path had to survive a component failure. Dispatchers work 24/7 and act on what they read, so here both paths must be free of single points of failure: a single-node store fails the read path as surely as it fails the write path. A durable queue between the API and the gateway turns a gateway outage into a delay (commands stay pending and go out when it returns) instead of a loss. Sizing: concurrency is still rate × duration; gateway workers are rate ÷ per-worker throughput, with headroom.",
      },
    ],
    glossary: [
      { term: "strong consistency", definition: "Every read returns the most recent committed write. Needed when a reader acts on the value (a command status), not merely looks at it." },
      { term: "eventual consistency", definition: "Reads may return an older value for a short time. Fine for a position map, wrong for a status that must never go backwards." },
      { term: "idempotency key", definition: "A client-generated id sent with a request and all of its retries, so the server can recognise a repeat and return the stored result instead of acting twice." },
      { term: "acknowledgement (ack)", definition: "The vehicle's confirmation that it received and accepted a command; the status moves from delivered to acknowledged." },
      { term: "standby", definition: "A replicated copy of a database that takes over automatically when the primary fails, keeping strong consistency." },
    ],
    hints: [
      { level: 1, title: "Start from the two hard requirements", body: "Strong consistency rules out every component marked eventual on the read path, however cheap or fast. No single point of failure on both paths rules out every component marked SPOF. What is left is small." },
      { level: 2, title: "Then the budget", body: "The budget is 1,200. The strongly consistent, replicated store costs 700 on its own, so the API has to be the cheap, scalable one: autoscaled containers (650) push the total to 1,460." },
      { level: 3, title: "Arithmetic", body: "Concurrency: 300 × 0.2 s = 60 (up to 120 with headroom). Gateway workers: 300 ÷ 20 = 15 (up to 40). Acknowledgement timeout: above the gateway's 4 s p99, below the dispatcher's 15 s patience. Idempotency records: at least the 10 minutes clients may keep retrying." },
      { level: 4, title: "Guided example", body: "Function behind an API gateway (300) + durable replicated queue (90) + managed relational database with standby (700) + direct status read (0) + idempotency key stored with the command (20) = 1,110 per month, no SPOF on either path, read 40 + 30 = 70 ms, strongly consistent. Concurrency 60, workers 20, timeout 8 s, retention 15 minutes. Drill 1: with a durable queue, commands wait as pending and go out when the gateway returns. Drill 2: with the standby store and a direct read, the acknowledged status is there after brief errors during the failover. Drill 3: with an idempotency key, the retry finds the stored result and the vehicle is told once." },
    ],
    reflectionPrompts: ["Walk me through this design and contrast it with the position ingest: why was a cache right there and wrong here, and what single requirement drove that change?"],
    transferNote: "The second design interview question is usually the first one with the requirements changed. Being able to say 'the cache was right last time because staleness was acceptable; here it is not, because the reader acts on the value' is exactly the reasoning interviewers look for.",
    requirements: {
      functional: ["Accept dispatcher commands at a peak of 300 commands/s during fleet-wide re-routes", "Deliver each command to the vehicle gateway and record the vehicle's acknowledgement", "A dispatcher's status read must never show an older state than one already seen (strongly consistent)", "A command must never be lost while the vehicle gateway is unavailable, and never be applied twice when a client retries"],
      peakIngestPerSec: 300,
      maxReadLatencyMs: 200,
      budget: 1200,
      noSpofOn: ["write", "read"],
      durableWrites: true,
      unit: "commands/s",
      durableLabel: "Commands survive a gateway outage (durable buffer)",
      consistency: "strong",
      justificationTerms: ["cost", "latency", "consistency", "failure", "idempotency", "retry"],
      justificationMinTerms: 3,
      justificationMinChars: 160,
    },
    slots: [
      {
        id: "api",
        label: "Command API",
        prompt: "What receives commands from the dispatcher console?",
        paths: ["write"],
        options: [
          { id: "vm", name: "Single VM running the API", description: "One instance, manually sized. Stops at ~800 commands/s and is a single point of failure.", cost: 120, capacity: 800, spof: true },
          { id: "containers", name: "Autoscaled containers behind a load balancer", description: "Several instances scaled on CPU; replicated load balancer and instance group. Sustains ~5,000 commands/s.", cost: 650, capacity: 5000 },
          { id: "function", name: "Function behind an API gateway", description: "Scales per request up to its concurrency limit; about 300/month at this load. Cold starts on bursts unless provisioned.", cost: 300, capacity: 10000 },
        ],
      },
      {
        id: "buffer",
        label: "Buffer between the API and the vehicle gateway",
        prompt: "What holds commands until the gateway has delivered them?",
        paths: ["write"],
        options: [
          { id: "direct", name: "None: the API calls the gateway directly", description: "Simplest. Every gateway hiccup becomes a failed command the dispatcher must re-send by hand.", cost: 0, capacity: 10000 },
          { id: "memory-broker", name: "In-memory broker on one node", description: "Fast, but one node: queued commands are lost on restart and the node is a single point of failure.", cost: 60, capacity: 10000, spof: true },
          { id: "durable-queue", name: "Durable replicated queue", description: "Persists commands until the gateway acknowledges them; replicated across zones. Adds a few ms.", cost: 90, capacity: 20000, durable: true },
        ],
      },
      {
        id: "store",
        label: "Command and status store",
        prompt: "Where are commands and their status (pending, delivered, acknowledged) stored?",
        paths: ["write", "read"],
        options: [
          { id: "single-db", name: "Single-node relational database", description: "Strong consistency, 40 ms reads, one node: a single point of failure on both paths.", cost: 300, capacity: 3000, latencyMs: 40, spof: true, consistency: "strong" },
          { id: "managed-db", name: "Managed relational database with standby", description: "Strong consistency, automatic failover to a standby, 40 ms reads.", cost: 700, capacity: 3000, latencyMs: 40, consistency: "strong" },
          { id: "kv-store", name: "Managed key-value store (replicated)", description: "Eventually consistent, replicated across zones, 10 ms reads. A read may miss an acknowledgement written moments ago.", cost: 250, capacity: 50000, latencyMs: 10, consistency: "eventual" },
        ],
      },
      {
        id: "read",
        label: "Status read path",
        prompt: "How does the dispatcher console read a command's status?",
        paths: ["read"],
        options: [
          { id: "direct-read", name: "Read the store directly by command id", description: "A keyed lookup, ~30 ms on top of the store's read, and exactly as consistent as the store.", cost: 0, latencyMs: 30 },
          { id: "cache", name: "Cache in front of the store", description: "~15 ms, but a cached status can lag the store by seconds: eventually consistent.", cost: 80, latencyMs: 15, consistency: "eventual" },
          { id: "replica", name: "Read replica", description: "~60 ms; lags the primary slightly, so an acknowledgement can be missing for a moment: eventually consistent.", cost: 350, latencyMs: 60, consistency: "eventual" },
        ],
      },
      {
        id: "dedup",
        label: "Duplicate prevention",
        prompt: "How is a retried request kept from sending the command twice?",
        paths: [],
        options: [
          { id: "none", name: "Nothing: every request is applied", description: "A retry after a timeout sends the command again.", cost: 0 },
          { id: "button", name: "Disable the Send button after a click", description: "Stops double clicks; does nothing about a network retry or a second tab.", cost: 0 },
          { id: "idempotency-key", name: "Idempotency key stored with the command", description: "The console generates a key per command and sends it with every retry; the API returns the stored result for a repeat. Small storage cost.", cost: 20 },
        ],
      },
    ],
    quantities: [
      { id: "concurrency", label: "Function concurrency limit for 300 commands/s at 200 ms", prompt: "If the command API is a function with an average duration of 200 ms, what concurrency limit does 300 commands/s need? (rate × duration)", unit: "concurrent executions", min: 60, max: 120, explanation: "300 × 0.2 s = 60; up to double for headroom on bursts." },
      { id: "workers", label: "Gateway workers to deliver 300 commands/s at 20 commands/s each", prompt: "Each gateway worker delivers 20 commands/s. How many workers keep up with 300 commands/s, with headroom so a backlog drains after an outage?", unit: "workers", min: 15, max: 40, explanation: "300 ÷ 20 = 15 is break-even; 20-30 drains a backlog. Above 40 is idle capacity." },
      { id: "ack-timeout", label: "Acknowledgement timeout between the gateway's 4 s p99 and the dispatcher's 15 s patience", prompt: "The gateway delivers 99% of commands within 4 s; dispatchers re-send by hand after 15 s. After how many seconds without an acknowledgement should the system retry a command?", unit: "seconds", min: 5, max: 15, explanation: "Above 4 s avoids retrying commands that are merely slow; at or below 15 s beats the dispatcher to it." },
      { id: "idempotency-retention", label: "Idempotency record retention at least as long as clients retry (10 minutes)", prompt: "Consoles and vehicles keep retrying a failed request for up to 10 minutes. For how many minutes must an idempotency record be kept so every retry is recognised?", unit: "minutes", min: 10, max: 1440, explanation: "At least the 10-minute retry window; a day is a common, cheap upper bound." },
    ],
    drills: [
      {
        id: "gateway-outage",
        prompt: "The vehicle gateway is unreachable for 3 minutes. With your design, what happens to the commands dispatchers send meanwhile?",
        options: ["They wait in the durable queue as pending and are delivered when the gateway returns", "They fail immediately and dispatchers must re-send them by hand", "They sit in the broker's memory and are lost if the broker restarts", "They are delivered from the cache"],
        answerFor: (c) => (c.buffer === "durable-queue" ? 0 : c.buffer === "memory-broker" ? 2 : 1),
        explanation: "Only a durable queue holds commands across a gateway outage. Direct calls fail; an in-memory broker keeps them only until it restarts.",
      },
      {
        id: "status-after-failover",
        prompt: "The store's primary fails over (30 seconds). Right after, a dispatcher refreshes a command that was acknowledged two seconds before the failover. What do they see?",
        options: ["The acknowledged status, after brief errors while the standby is promoted", "Possibly 'pending': the cache or replica has not seen the acknowledgement yet", "Errors until someone restores the single node; there is no standby", "Possibly 'pending': the eventually consistent store may answer from a copy without the acknowledgement"],
        answerFor: (c) => (c.store === "single-db" ? 2 : c.read === "cache" || c.read === "replica" ? 1 : c.store === "kv-store" ? 3 : 0),
        explanation: "A standby preserves the committed acknowledgement; a direct read returns it once the standby is up. Anything eventually consistent on the read path, a cache, a replica or the key-value store, can show the older status.",
      },
      {
        id: "double-send",
        prompt: "A dispatcher's console retries a command because the first response timed out. With your design, how many times is the vehicle told to reroute?",
        options: ["Once: the retry carries the same idempotency key and gets the stored result", "Twice: disabling the button does not stop a network retry", "Twice: every request is applied", "Zero: the timed-out request is dropped"],
        answerFor: (c) => (c.dedup === "idempotency-key" ? 0 : c.dedup === "button" ? 1 : 2),
        explanation: "Only a server-side idempotency key recognises a retried request. A disabled button prevents double clicks, not retries; with nothing in place every request is applied.",
      },
    ],
    referenceDesign: {
      choices: { api: "function", buffer: "durable-queue", store: "managed-db", read: "direct-read", dedup: "idempotency-key" },
      quantities: { concurrency: 60, workers: 20, "ack-timeout": 8, "idempotency-retention": 15 },
      justification:
        "The function behind an API gateway handles the 300 commands/s peak for about 300 and has no single point of failure. A durable replicated queue holds commands while the gateway is down, so a failure delays delivery instead of losing it. The managed relational database with standby keeps status reads strongly consistent, which a cache or replica would break, and a direct keyed read at 40 + 30 ms stays within the 200 ms latency budget. An idempotency key stored with each command makes a retry harmless. Total cost 1,110.",
    },
  },
];
