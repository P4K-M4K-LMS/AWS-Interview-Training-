import type { IncidentMission, PythonMission } from "../../domain/types";

/**
 * Serverless and event-driven missions on the shared platform simulation.
 * The "functions" here are a generic model (concurrency limits, cold starts,
 * retries, dead-letter queues, idempotency), not an emulation of any
 * vendor's service. Nimbus Freight is fictional.
 */
const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. Part of it now runs as managed functions: a synchronous function serves the positions API and an asynchronous function processes billing events from the job queue. You are on call.";

const SHARED_LESSON = [
  {
    title: "The incident loop",
    body: "Detect → **investigate** (what do the metrics and logs actually say?) → form a hypothesis → **remediate the cause**, not the symptom → **verify** recovery with the same signals that showed the problem → write it down so it does not happen again.",
  },
  {
    title: "How functions scale",
    body: "A function platform runs one invocation per execution environment and starts more environments as traffic rises, up to a **concurrency limit**. The concurrency a workload needs is arithmetic: invocations per second × average duration in seconds (300/s × 0.12 s = 36). Above the limit the platform **throttles**: it rejects invocations instead of queueing them. A brand-new environment pays a **cold start** (hundreds of milliseconds of initialisation); **provisioned concurrency** keeps a set number warm in exchange for paying for them while idle.\n\nAsynchronous invocations (events, queue messages) are retried by the platform when they fail or time out. A message that can never succeed is **poison**; without a **dead-letter queue** it is retried forever. A handler that can safely run twice for the same event is **idempotent**; one that cannot will repeat its side effects on every retry.",
  },
];

const SHARED_GLOSSARY = [
  { term: "concurrency limit", definition: "The maximum number of simultaneous executions a function may have; invocations beyond it are throttled." },
  { term: "throttling", definition: "The platform rejecting invocations because the concurrency limit is reached. Shows up as 429-style errors, not as queueing." },
  { term: "cold start", definition: "The initialisation cost paid when an invocation lands on a new execution environment." },
  { term: "provisioned concurrency", definition: "Environments kept warm ahead of traffic so invocations never pay a cold start, at a standing cost." },
  { term: "dead-letter queue (DLQ)", definition: "A holding queue for messages that failed too many times, so they stop being retried and can be inspected." },
  { term: "idempotent", definition: "An operation whose effect is the same whether applied once or many times; what makes retries safe." },
];

export const serverlessIncidents: IncidentMission[] = [
  {
    id: "serverless-01-throttled-function",
    kind: "incident",
    trackId: "serverless",
    stage: 6,
    title: "Incident: the positions function is throttling under a traffic surge",
    summary: "Errors spike while workers, cache and database look fine. Size the function's concurrency from rate × duration, then watch cold starts and decide about provisioned concurrency.",
    briefing: `${COMPANY_INTRO}\n\nA partner integration tripled traffic on the positions API, which is now served by a function. Error rate jumped to 60%. The API workers, cache and database are healthy. The partner's traffic is legitimate and must be served.`,
    objectives: [
      "Confirm from Metrics and Logs that the function's concurrency limit, not the workers or the database, is rejecting invocations",
      "Identify the root cause",
      "Raise the concurrency limit to what 300 invocations/s × 120 ms needs (36 or more) without shedding traffic; optionally pre-warm with provisioned concurrency; verify 5 healthy seconds",
      "Write the note including the concurrency arithmetic and the cold-start tradeoff",
    ],
    skills: ["serverless.functions", "serverless.scaling", "serverless.observability"],
    prerequisites: ["incident-02-traffic-surge"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Throttling is a limit problem; cold starts are a warm-up problem",
        body: "Throttles disappear the moment the limit is high enough. Cold starts do not: new environments warm up a few per second, so latency stays high for a while after a limit increase. If the surge is predictable, provisioned concurrency at (or near) the needed level removes the cold starts at a standing cost. Shedding legitimate traffic or adding API workers changes nothing, because the bottleneck is the function's limit.",
      },
    ],
    glossary: SHARED_GLOSSARY,
    hints: [
      { level: 1, title: "Which tier is rejecting?", body: "API load, cache hit ratio and db qps are normal. Look at the function stats: needed concurrency vs the limit, and the throttled percentage." },
      { level: 2, title: "Do the arithmetic", body: "300 invocations/s × 0.12 s = 36 concurrent executions needed. The limit is 10, so 72% of invocations are throttled. Set the limit to at least 36 (40 leaves headroom)." },
      { level: 3, title: "Cold starts after the fix", body: "After raising the limit, environments warm up 2 per second, so p95 stays high for a dozen seconds. Set provisioned concurrency to about 36 to skip that, or wait it out. Do not shed traffic." },
      { level: 4, title: "Guided example", body: "Open Metrics (throttled 72%, needed 36 / limit 10), open Logs (Rate exceeded), answer root cause = concurrency limit below rate × duration, set the concurrency limit to 40, set provisioned concurrency to 36, advance time until healthy for 5 s, write the note with the arithmetic." },
    ],
    reflectionPrompts: ["Explain how you sized the concurrency limit and what you would decide about provisioned concurrency if the surge happened every morning at 08:00."],
    transferNote: "Rate × duration is the one formula every serverless capacity conversation comes back to; being able to say it, and separate throttling from cold starts, is a strong interview answer.",
    scenario: {
      initialConfig: {
        requestsPerSec: 300,
        workers: 8,
        cacheHitRate: 0.9,
        dbDegraded: false,
        deployInProgress: false,
        queueConsumers: 4,
        serverless: { durationMs: 120, reservedConcurrency: 10, provisionedConcurrency: 0, poisonRate: 0, maxReceiveCount: 3, dlqEnabled: true, timeoutRate: 0, asyncRetries: 2, handlerIdempotent: true },
      },
      initialQueueDepth: 30,
      initialServerless: { warmEnvironments: 10 },
      ticket: {
        title: "INC-2090: positions API 60% errors after partner traffic tripled",
        reporter: "PagerDuty via monitoring",
        description: "Traffic rose from 100 to 300 req/s when a partner enabled their integration. The positions endpoint is served by a function with a concurrency limit of 10 set at launch. Workers, cache and database dashboards are green.",
        symptoms: ["error rate ~60% (rate exceeded)", "function throttles climbing", "API worker load normal", "database and cache normal"],
        impact: "Partner and dispatchers see failed position lookups.",
      },
      allowedActions: ["set-reserved-concurrency", "set-provisioned-concurrency", "scale-workers", "set-traffic", "set-cache-hit"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "The API workers are saturated by the partner traffic",
          "The function's concurrency limit (10) is far below what 300 invocations/s × 120 ms needs (36), so the platform throttles the excess",
          "The database cannot keep up with the extra reads",
          "Cold starts are making every invocation slow",
        ],
        correctIndex: 1,
        explanation: "Needed concurrency is rate × duration = 36; the limit is 10, so about 72% of invocations are rejected. Workers, cache and database are within capacity; cold starts only appear after the limit is raised.",
      },
      remediationCheck: (c, sim) => {
        const s = c.serverless!;
        if (c.requestsPerSec < 300) return { passed: false, detail: "Rate limiting rejects legitimate partner traffic; restore it and raise the limit" };
        const needed = Math.ceil((c.requestsPerSec * s.durationMs) / 1000);
        if (s.reservedConcurrency < needed) return { passed: false, detail: c.workers > 8 ? "More API workers do not change the function's limit" : `limit ${s.reservedConcurrency} < needed ${needed} (${c.requestsPerSec}/s × ${s.durationMs} ms)` };
        if (sim.warmEnvironments < needed * 0.8 && s.provisionedConcurrency < needed * 0.8) return { passed: true, detail: "limit raised; environments still warming up (cold starts)" };
        return { passed: true };
      },
      verifyTicks: 5,
      postmortemPrompt: "Write the note: what happened, the arithmetic (rate × duration), what you changed, the cold-start effect you observed, and whether provisioned concurrency is worth its standing cost here.",
    },
  },
  {
    id: "serverless-02-poison-messages",
    kind: "incident",
    trackId: "serverless",
    stage: 6,
    title: "Incident: billing events pile up behind poison messages",
    summary: "The queue grows although consumers are alive. Find the malformed messages being retried forever, add a dead-letter queue with a sane receive count, then drain the backlog.",
    briefing: `${COMPANY_INTRO}\n\nThe billing queue depth has been climbing for ten minutes. The async billing function is running and its consumers are healthy, yet almost nothing is getting through. Finance reports invoices arriving late.`,
    objectives: [
      "Use Logs and Metrics to find the messages that fail on every attempt and how many times they have been received",
      "Identify the root cause",
      "Enable a dead-letter queue with a receive count between 2 and 5, then add consumer capacity to drain the backlog; verify the queue returns to a healthy depth",
      "Write the note including an alert on DLQ depth and a validation step at the producer",
    ],
    skills: ["serverless.events", "serverless.observability", "distributed.queues"],
    prerequisites: ["serverless-01-throttled-function"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Poison messages and the dead-letter queue",
        body: "A message with a malformed payload fails every time it is processed. Without a dead-letter queue the platform makes it visible again after every failure, so each poison message consumes one processing slot per second forever. Sixty of them eat the entire capacity of two consumers (50 jobs/s) and the good messages queue up behind them. A dead-letter queue with a **max receive count** of about 3 moves a message aside after three failures: transient failures still get their retries, poison stops burning capacity, and the DLQ depth becomes the alert that tells you data is being rejected. Setting the count to 1 is wrong too: every transient failure would go straight to the DLQ.",
      },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "receive count", definition: "How many times a message has been delivered to a consumer; the platform compares it with the maximum before moving the message to the DLQ." }, { term: "poison message", definition: "A message that fails on every attempt, usually because its payload is malformed." }],
    hints: [
      { level: 1, title: "Alive but not draining", body: "Consumers are running and the function is healthy. Look at 'poison messages retrying' in Metrics and the KeyError lines in Logs with their receive counts." },
      { level: 2, title: "Why nothing gets through", body: "About 60 malformed messages are retried every second. Each retry costs a processing slot, so 2 consumers (50 jobs/s) spend all their capacity on messages that can never succeed." },
      { level: 3, title: "Cause first, then capacity", body: "Enable the dead-letter queue with max receive count 3. The poison backlog drains within seconds. Then restart consumers at 4 or more to drain the real backlog; adding consumers without the DLQ only hides the problem." },
      { level: 4, title: "Guided example", body: "Open Logs (KeyError 'vehicle_id', receive count 70+, no dead-letter queue), open Metrics (poison retrying ~60, queue depth rising), root cause = poison messages retried forever without a DLQ, enable DLQ with max receive 3, restart consumers at 6, advance time until depth < 300 and healthy 5 s, write the note with a DLQ-depth alert and producer-side validation." },
    ],
    reflectionPrompts: ["Explain why adding consumers alone would have looked like a fix and why it was not one, and what the DLQ depth tells you afterwards."],
    transferNote: "Retry semantics, receive counts and dead-letter queues are standard questions about event-driven systems; the capacity reasoning (each retry costs a slot) is what makes the answer concrete.",
    scenario: {
      initialConfig: {
        requestsPerSec: 150,
        workers: 4,
        cacheHitRate: 0.85,
        dbDegraded: false,
        deployInProgress: false,
        queueConsumers: 2,
        serverless: { durationMs: 100, reservedConcurrency: 50, provisionedConcurrency: 0, poisonRate: 0.02, maxReceiveCount: 10, dlqEnabled: false, timeoutRate: 0, asyncRetries: 2, handlerIdempotent: true },
      },
      initialQueueDepth: 500,
      initialServerless: { warmEnvironments: 15, poisonBacklog: 60 },
      ticket: {
        title: "INC-2094: billing queue depth rising; consumers healthy",
        reporter: "Finance + queue-depth alert",
        description: "Queue depth has climbed since 09:00 although both consumers report healthy and the billing function shows no throttles. A partner started sending events in a new format this morning.",
        symptoms: ["queue depth rising ~45 jobs/s", "consumers alive, throughput near zero", "billing function logging KeyError on the same message ids with growing receive counts", "no dead-letter queue configured"],
        impact: "Invoices delayed; grows every second.",
      },
      allowedActions: ["enable-dlq", "set-consumers", "set-traffic", "scale-workers"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "The consumers crashed and nothing drains the queue",
          "Malformed messages fail on every attempt and, with no dead-letter queue, are retried forever, consuming the consumers' capacity",
          "Producers publish faster than any number of consumers can drain",
          "The function's concurrency limit is too low",
        ],
        correctIndex: 1,
        explanation: "The logs show the same message ids failing with receive counts above 70; about 60 poison messages are retried every second, which is more than the 50 jobs/s the two consumers can process.",
      },
      remediationCheck: (c, sim) => {
        const s = c.serverless!;
        if (c.requestsPerSec < 150) return { passed: false, detail: "Shedding traffic drops billing events; restore it" };
        if (!s.dlqEnabled) return { passed: false, detail: c.queueConsumers > 2 ? "more consumers hide the symptom; the poison messages are still retried forever" : "poison messages are still retried forever: no dead-letter queue" };
        if (s.maxReceiveCount < 2) return { passed: false, detail: "max receive count 1 sends every transient failure to the DLQ; use 2-5" };
        if (s.maxReceiveCount > 5) return { passed: false, detail: `max receive count ${s.maxReceiveCount} keeps poison messages burning capacity for too long; use 2-5` };
        if (sim.queueDepth > 300 && c.queueConsumers * 25 - sim.poisonBacklog <= c.requestsPerSec * 0.3) return { passed: true, detail: "cause fixed; add consumers to drain the backlog faster" };
        return { passed: true };
      },
      verifyTicks: 5,
      postmortemPrompt: "Write the note: what happened, why consumers looked healthy, what you changed (DLQ + receive count, then capacity), the alert you will add on DLQ depth, and the validation you will ask the producer to add.",
    },
  },
  {
    id: "serverless-03-duplicate-charges",
    kind: "incident",
    trackId: "serverless",
    stage: 6,
    title: "Incident: customers charged twice after function timeouts",
    summary: "Timed-out invocations are retried by the platform and the handler is not idempotent. Stop the duplicates without dropping work.",
    briefing: `${COMPANY_INTRO}\n\nFinance sees duplicate charges on about one invoice in seven since the payment provider slowed down this morning. The invoice function is timing out on some calls; the platform retries timed-out asynchronous invocations twice.`,
    objectives: [
      "Use Logs and Metrics to connect the timeouts, the platform retries and the duplicate charges",
      "Identify the root cause",
      "Stop the duplicates by making the handler idempotent (keep the retries) and verify; raising the timeout budget is a good complement",
      "Write the note including the idempotency-key design",
    ],
    skills: ["serverless.idempotency", "serverless.events", "distributed.resilience"],
    prerequisites: ["serverless-02-poison-messages"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Retries are only safe when the handler is idempotent",
        body: "An invocation can time out after its side effect happened: the charge was recorded, the function was killed before it reported success, and the platform retried it. Turning retries off stops the duplicates but drops every timed-out event instead: lost invoices. The durable fix is an **idempotency key** (the event id or invoice id) checked and stored with the side effect, so a retry finds the record and returns the stored result. Raising the timeout and the downstream budget reduces how often it happens; it does not make a non-idempotent handler safe.",
      },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "idempotency key", definition: "A unique id per operation (event id, invoice id) stored with the side effect so repeats can be recognised and skipped." }, { term: "at-least-once delivery", definition: "The platform guarantees an event is processed at least once, which means it may be processed more than once." }],
    hints: [
      { level: 1, title: "Follow the retries", body: "Logs show 'Task timed out' followed by 'retry of invocation ... charge recorded twice'. Metrics show duplicate side effects growing by about 4.5 per second." },
      { level: 2, title: "Two wrong fixes", body: "Setting retries to 0 stops duplicates but the lost-invocations counter starts climbing. Raising the timeout reduces timeouts to about 1%, so duplicates slow down but do not stop." },
      { level: 3, title: "The right fix", body: "Deploy the idempotent handler (idempotency keys). Keep retries at 2 so timed-out events are still delivered. Raise the timeout as well to reduce wasted work." },
      { level: 4, title: "Guided example", body: "Open Logs (timed out, charge recorded twice), open Metrics (duplicate side effects +4.5/s), root cause = platform retries + non-idempotent handler, deploy the idempotent handler, raise the function timeout, advance time until healthy 5 s, write the note describing the idempotency key." },
    ],
    reflectionPrompts: ["Explain to a finance manager why turning retries off would have traded double charges for missing invoices, and what the idempotency key changes."],
    transferNote: "At-least-once delivery plus idempotent handlers is the pattern behind every reliable event-driven system; this incident is the interview story for it.",
    scenario: {
      initialConfig: {
        requestsPerSec: 100,
        workers: 4,
        cacheHitRate: 0.85,
        dbDegraded: false,
        deployInProgress: false,
        queueConsumers: 2,
        serverless: { durationMs: 100, reservedConcurrency: 50, provisionedConcurrency: 0, poisonRate: 0, maxReceiveCount: 3, dlqEnabled: true, timeoutRate: 0.15, asyncRetries: 2, handlerIdempotent: false },
      },
      initialQueueDepth: 10,
      initialServerless: { warmEnvironments: 10, duplicateSideEffects: 120 },
      ticket: {
        title: "INC-2097: duplicate charges on ~1 in 7 invoices since 08:30",
        reporter: "Finance",
        description: "The payment provider's latency rose this morning. The invoice function times out on about 15% of invocations (3 s limit). The platform retries timed-out asynchronous invocations twice. Finance has refunded 120 duplicate charges so far.",
        symptoms: ["'Task timed out' in the invoice function logs", "retried invocations logging the same invoice twice", "duplicate side effects rising ~4.5/s", "queue and API healthy"],
        impact: "Customers charged twice; refunds and trust cost.",
      },
      allowedActions: ["make-handler-idempotent", "raise-function-timeout", "set-async-retries", "set-consumers", "restart-db"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "The payment provider is charging twice on its side",
          "Timed-out invocations are retried by the platform and the handler is not idempotent, so a charge recorded before the timeout is recorded again on the retry",
          "Too few consumers, so events are processed late and twice",
          "Asynchronous queues always deliver duplicates; nothing can be done",
        ],
        correctIndex: 1,
        explanation: "The logs pair each timeout with a retry that records the same invoice again. At-least-once delivery is by design; the missing piece is an idempotent handler.",
      },
      remediationCheck: (c) => {
        const s = c.serverless!;
        if (s.asyncRetries === 0 && !s.handlerIdempotent) return { passed: false, detail: "retries off: duplicates stop but timed-out invoices are now lost" };
        if (!s.handlerIdempotent) return { passed: false, detail: s.timeoutRate < 0.1 ? "fewer timeouts, but every remaining retry still duplicates the charge" : "the handler still repeats the charge on retry" };
        if (s.asyncRetries === 0) return { passed: false, detail: "handler is idempotent now; restore retries so timed-out events are delivered" };
        return { passed: true };
      },
      verifyTicks: 5,
      postmortemPrompt: "Write the note: what happened, why retries are correct and the handler was not, the idempotency-key design (what key, where stored, what a retry returns), and the timeout change.",
    },
  },
];

export const serverlessPythonMissions: PythonMission[] = [
  {
    id: "serverless-04-idempotent-handler",
    kind: "python",
    trackId: "serverless",
    stage: 6,
    title: "Write an idempotent event handler",
    summary: "Implement the fix from the duplicate-charges incident: validate events, charge at most once per idempotency key, and return the stored result on retries.",
    briefing: `${COMPANY_INTRO}\n\nAfter the duplicate-charge incident, you own the invoice handler. Events may arrive more than once (at-least-once delivery). Write a handler that validates each event, performs the charge exactly once per event id, stores the result under that id, and returns the stored result when the same event is retried. A batch processor must never crash on a bad event.`,
    objectives: [
      "handle(event, store, charge) validates the event: keys id, invoice, amount; amount must be a positive number; otherwise raise ValueError",
      "On the first delivery of an id, call charge(invoice, amount) once, store {'invoice', 'receipt', 'status': 'charged'} under store[id] and return it",
      "On a retry of the same id, do not call charge; return the stored result with status 'duplicate'",
      "process_batch(events, store, charge) returns {'charged': n, 'duplicate': n, 'rejected': n} and never raises",
    ],
    skills: ["serverless.idempotency", "python.errors"],
    prerequisites: ["serverless-03-duplicate-charges", "python-04-fleet-report"],
    estimatedMinutes: 25,
    lesson: [
      {
        title: "Check, act, record, in that order",
        body: "The idempotency table (here a dict, in production a database table with the key as primary key) is consulted first: `if event['id'] in store: return {**store[event['id']], 'status': 'duplicate'}`. Then the side effect, then the record. If the process dies between the side effect and the record you can still double-charge, which is why real systems write the record and the charge in one transaction or make the charge itself keyed; the structure is the same.",
      },
      {
        title: "Validate before you touch money",
        body: "Reject events that cannot be processed with a clear `ValueError` (missing keys, non-numeric or non-positive amount). The batch processor turns those into a `rejected` count instead of a crash: the one poison event must not stop the other 999.",
      },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "side effect", definition: "A change outside the function (a charge, an email, a row) that cannot be undone by returning early." }],
    hints: [
      { level: 1, title: "Validate first", body: "`for key in ('id', 'invoice', 'amount'): if key not in event: raise ValueError(f'missing {key}')`. Then `if not isinstance(amount, (int, float)) or isinstance(amount, bool) or amount <= 0: raise ValueError('amount must be positive')`." },
      { level: 2, title: "Lookup before the charge", body: "`if event['id'] in store: return {**store[event['id']], 'status': 'duplicate'}`. Only call `charge(...)` when the id is new, then save the result dict in `store[event['id']]`." },
      { level: 3, title: "The batch", body: "Loop, `try: result = handle(...)` then count `result['status']`; `except ValueError: counts['rejected'] += 1`." },
      { level: 4, title: "Guided example", body: "```\ndef handle(event, store, charge):\n    for key in ('id', 'invoice', 'amount'):\n        if key not in event:\n            raise ValueError(f'missing {key}')\n    amount = event['amount']\n    if isinstance(amount, bool) or not isinstance(amount, (int, float)) or amount <= 0:\n        raise ValueError('amount must be a positive number')\n    if event['id'] in store:\n        return {**store[event['id']], 'status': 'duplicate'}\n    receipt = charge(event['invoice'], amount)\n    result = {'invoice': event['invoice'], 'receipt': receipt, 'status': 'charged'}\n    store[event['id']] = result\n    return result\n```" },
    ],
    reflectionPrompts: ["Describe the order of operations in your handler and the failure window that remains. How would you close it in a real system?"],
    transferNote: "Idempotent handlers are asked about in nearly every event-driven design interview; having written and tested one lets you answer with specifics.",
    starterCode: `def handle(event, store, charge):
    """Process one billing event at most once per event id.

    event: dict with 'id', 'invoice', 'amount'
    store: dict used as the idempotency table (event id -> stored result)
    charge: function(invoice, amount) -> receipt id (the side effect)
    Returns {'invoice': ..., 'receipt': ..., 'status': 'charged' | 'duplicate'}
    Raises ValueError for invalid events.
    """
    # TODO: validate, check the store, charge once, record, return
    receipt = charge(event["invoice"], event["amount"])
    return {"invoice": event["invoice"], "receipt": receipt, "status": "charged"}


def process_batch(events, store, charge):
    """Process many events; never raise. Returns counts by outcome."""
    counts = {"charged": 0, "duplicate": 0, "rejected": 0}
    for event in events:
        result = handle(event, store, charge)
        counts[result["status"]] += 1
    return counts


if __name__ == "__main__":
    receipts = []

    def charge(invoice, amount):
        receipts.append((invoice, amount))
        return f"rcpt-{len(receipts)}"

    store = {}
    events = [
        {"id": "evt-1", "invoice": "INV-1", "amount": 25.0},
        {"id": "evt-1", "invoice": "INV-1", "amount": 25.0},  # retry
        {"id": "evt-2", "invoice": "INV-2", "amount": 0},      # invalid
    ]
    print(process_batch(events, store, charge), "charges made:", len(receipts))
`,
    referenceSolution: `def handle(event, store, charge):
    for key in ("id", "invoice", "amount"):
        if key not in event:
            raise ValueError(f"missing {key}")
    amount = event["amount"]
    if isinstance(amount, bool) or not isinstance(amount, (int, float)) or amount <= 0:
        raise ValueError("amount must be a positive number")
    if event["id"] in store:
        return {**store[event["id"]], "status": "duplicate"}
    receipt = charge(event["invoice"], amount)
    result = {"invoice": event["invoice"], "receipt": receipt, "status": "charged"}
    store[event["id"]] = result
    return result


def process_batch(events, store, charge):
    counts = {"charged": 0, "duplicate": 0, "rejected": 0}
    for event in events:
        try:
            result = handle(event, store, charge)
        except ValueError:
            counts["rejected"] += 1
            continue
        counts[result["status"]] += 1
    return counts


if __name__ == "__main__":
    receipts = []

    def charge(invoice, amount):
        receipts.append((invoice, amount))
        return f"rcpt-{len(receipts)}"

    store = {}
    events = [
        {"id": "evt-1", "invoice": "INV-1", "amount": 25.0},
        {"id": "evt-1", "invoice": "INV-1", "amount": 25.0},  # retry
        {"id": "evt-2", "invoice": "INV-2", "amount": 0},      # invalid
    ]
    print(process_batch(events, store, charge), "charges made:", len(receipts))
`,
    tests: [
      { id: "t1", label: "first delivery charges once and stores the result", code: `calls = []\nstore = {}\nr = handle({"id": "e1", "invoice": "INV-9", "amount": 12.5}, store, lambda inv, amt: calls.append((inv, amt)) or "rcpt-1")\nassert r == {"invoice": "INV-9", "receipt": "rcpt-1", "status": "charged"}, r\nassert calls == [("INV-9", 12.5)], calls\nassert store["e1"]["receipt"] == "rcpt-1"` },
      { id: "t2", label: "a retry of the same id does not charge again and reports duplicate", code: `calls = []\nstore = {}\ncharge = lambda inv, amt: calls.append(inv) or f"rcpt-{len(calls)}"\nfirst = handle({"id": "e1", "invoice": "INV-9", "amount": 5}, store, charge)\nagain = handle({"id": "e1", "invoice": "INV-9", "amount": 5}, store, charge)\nassert again["status"] == "duplicate" and again["receipt"] == first["receipt"], again\nassert calls == ["INV-9"], calls` },
      { id: "t3", label: "invalid events raise ValueError before any charge", code: `calls = []\nstore = {}\ncharge = lambda inv, amt: calls.append(inv) or "r"\nfor bad in [{"invoice": "I", "amount": 1}, {"id": "x", "amount": 1}, {"id": "y", "invoice": "I"}, {"id": "z", "invoice": "I", "amount": 0}, {"id": "w", "invoice": "I", "amount": "10"}, {"id": "v", "invoice": "I", "amount": -3}]:\n    try:\n        handle(bad, store, charge)\n    except ValueError:\n        pass\n    else:\n        raise AssertionError(f"accepted invalid event {bad}")\nassert calls == [] and store == {}, (calls, store)` },
      { id: "t4", label: "a batch with retries and bad events counts correctly and charges exactly once per id", code: `calls = []\nstore = {}\ncharge = lambda inv, amt: calls.append(inv) or f"rcpt-{len(calls)}"\nevents = [{"id": "a", "invoice": "A", "amount": 1}, {"id": "b", "invoice": "B", "amount": 2}, {"id": "a", "invoice": "A", "amount": 1}, {"id": "bad", "invoice": "C"}, {"id": "b", "invoice": "B", "amount": 2}, {"id": "c", "invoice": "C", "amount": 3}]\ncounts = process_batch(events, store, charge)\nassert counts == {"charged": 3, "duplicate": 2, "rejected": 1}, counts\nassert sorted(calls) == ["A", "B", "C"], calls` },
    ],
    errorHelp: [
      { match: /KeyError/, explanation: "The event is missing a key. Validate with `if key not in event` before indexing, and raise ValueError so the batch can count it as rejected." },
      { match: /AssertionError/, explanation: "A test assertion failed: read the expected vs actual values in the message. Common causes: charging on a retry, or returning status 'charged' for a duplicate." },
      { match: /TypeError/, explanation: "Usually comparing a string amount with a number. Check the type before comparing and reject non-numeric amounts with ValueError." },
    ],
  },
];
