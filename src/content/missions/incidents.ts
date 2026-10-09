import type { IncidentMission } from "../../domain/types";

const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are on the operations team's on-call rotation.";

const SHARED_LESSON = [
  {
    title: "The incident loop",
    body: "Detect → **investigate** (what do the metrics and logs actually say?) → form a hypothesis → **remediate the cause**, not the symptom → **verify** recovery with the same signals that showed the problem → write it down so it does not happen again.\n\nA fix that makes the dashboard green while turning customers away, or while the real cause is still there, is not a fix.",
  },
  {
    title: "Reading the platform",
    body: "Requests arrive at the API gateway and are served by N workers (about 60 req/s each). Reads go to the cache first; misses fall through to the primary database, which handles about 100 queries/s before queuing. Writes publish jobs to a queue that consumers drain at 25 jobs/s each.\n\nSo: load = requests ÷ (workers × 60); database pressure = requests × miss rate; queue depth grows when producers out-pace consumers.",
  },
];

const SHARED_GLOSSARY = [
  { term: "p95 latency", definition: "The response time that 95% of requests beat. It exposes the slow tail that averages hide." },
  { term: "error rate", definition: "Share of requests that fail (5xx). Above a few percent, users notice." },
  { term: "root cause", definition: "The underlying condition that, if fixed, stops the symptoms from recurring." },
  { term: "remediation", definition: "The change that removes the cause. Mitigation only reduces impact." },
  { term: "postmortem", definition: "A blameless written record: what happened, why, how it was fixed, how it will be prevented." },
];

export const incidentMissions: IncidentMission[] = [
  {
    id: "incident-01-cache-stampede",
    kind: "incident",
    trackId: "devops",
    stage: 3,
    title: "Incident: positions API slow after the 09:00 deploy",
    summary: "Latency and errors climb minutes after a deploy. Use metrics and logs to find the real cause and fix it, not the symptom.",
    briefing: `${COMPANY_INTRO}\n\nPagerDuty fires at 09:04: p95 latency over 1 second and 5xx errors on the positions API. A deploy finished at 09:00. Customer support reports dispatchers seeing stale maps. You are the responder.`,
    objectives: [
      "Read the ticket, the metrics and the logs before changing anything",
      "Identify the root cause from the evidence",
      "Apply the remediation that removes the cause and verify recovery for 5 seconds",
      "Write a short post-incident note",
    ],
    skills: ["devops.monitoring", "distributed.architecture"],
    prerequisites: ["devops-01-broken-pipeline"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Cache stampedes",
        body: "When thousands of cache keys expire at the same instant (for example because a deploy set them all with the same TTL), every request misses at once and the database takes the full load. The symptom is latency and errors at the API; the cause is the cache. Scaling API workers does nothing for a database that is already saturated. The durable fix is re-warming the cache with **jittered** TTLs so expiries spread out.",
      },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "TTL jitter", definition: "Adding a random offset to each cache entry's lifetime so entries do not all expire together." }],
    hints: [
      { level: 1, title: "Follow the pressure", body: "The API is slow, but is the API the bottleneck? Check the cache hit ratio and the database queries/s in Metrics and Logs." },
      { level: 2, title: "One number explains it", body: "Hit ratio 30% means 70% of 200 req/s reach the database: 140 qps against a capacity of 100. The logs say why the ratio collapsed." },
      { level: 3, title: "Fix the cause", body: "Scaling workers or shedding traffic hides the symptom. Re-warm the cache with jittered TTLs so the hit ratio returns above 80%." },
      { level: 4, title: "Guided example", body: "Open Logs (note 'keys expired at the same second'), open Metrics (db qps > capacity), answer root cause = cache keys expired together, run 'Re-warm cache with jittered TTLs' at 85%, wait until the health check stays healthy for 5s, write the note." },
    ],
    reflectionPrompts: ["Walk me through how you decided the database, not the API workers, was the bottleneck, and how you verified the fix."],
    transferNote: "Cache stampedes after deploys are a classic production incident; the diagnostic path (hit ratio → db qps → logs) transfers directly.",
    scenario: {
      initialConfig: { requestsPerSec: 200, workers: 4, cacheHitRate: 0.3, dbDegraded: false, deployInProgress: false, queueConsumers: 2 },
      initialQueueDepth: 20,
      ticket: {
        title: "INC-2041: positions API p95 > 1s, 5xx errors",
        reporter: "PagerDuty via monitoring",
        description: "Alert fired at 09:04 after the 09:00 deploy of fleet-api v2.3.1. Dispatchers report stale maps and intermittent errors.",
        symptoms: ["p95 latency above 1,000 ms", "5xx error rate around 10%", "CPU on API workers only moderately elevated"],
        impact: "All customers: vehicle positions update late or fail. Revenue impact if it persists past 30 minutes.",
      },
      allowedActions: ["scale-workers", "set-cache-hit", "restart-db", "rollback-deploy", "set-traffic"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "Not enough API workers for the traffic",
          "Thousands of cache keys expired at the same second, so most requests miss the cache and overload the database",
          "The primary database has failed and needs a failover",
          "A traffic spike from a marketing campaign",
        ],
        correctIndex: 1,
        explanation: "The logs show 4,120 keys expiring together with a fixed TTL set at deploy; the hit ratio fell to 30%, sending 140 qps to a database that handles 100.",
      },
      remediationCheck: (c) =>
        c.cacheHitRate >= 0.8
          ? { passed: true }
          : { passed: false, detail: c.requestsPerSec < 200 ? "Shedding traffic turns customers away and leaves the cache broken" : c.workers > 4 ? "More workers do not help a saturated database" : "Cache hit ratio is still below 80%" },
      verifyTicks: 5,
      postmortemPrompt: "Write the post-incident note: what happened, why, what you did, and how it will be prevented (e.g. TTL jitter in the deploy).",
    },
  },
  {
    id: "incident-02-traffic-surge",
    kind: "incident",
    trackId: "distributed",
    stage: 4,
    title: "Incident: capacity exhausted during a traffic surge",
    summary: "Traffic quadruples and two tiers hit their limits. Decide between shedding load and adding capacity, size both tiers, and prove the system recovered.",
    briefing: `${COMPANY_INTRO}\n\nA large logistics partner just switched on integration with Nimbus and traffic jumped from 120 to 500 req/s. Error rate is 60% and the on-call channel is on fire. The partner is a real customer; turning them away is not an acceptable fix.`,
    objectives: [
      "Confirm from metrics and logs which tiers are saturated (API workers and queue consumers) and which are fine (cache, database)",
      "Identify the root cause",
      "Add enough capacity to bring API load below ~95% and let the queue drain, without shedding customer traffic, and verify recovery",
      "Write a post-incident note including the capacity rules you applied",
    ],
    skills: ["distributed.performance", "distributed.scaling"],
    prerequisites: ["incident-01-cache-stampede"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Throughput, latency and capacity",
        body: "Each worker serves about 60 req/s. Above ~70% load, latency rises as requests queue; above ~95%, requests are rejected. Capacity planning is arithmetic: 500 req/s ÷ 60 ≈ 8.3 workers at 100%, so 9 workers keeps load near 93%. Horizontal scaling (more workers) is the right lever when the bottleneck is the stateless tier. Rate limiting is a temporary mitigation, not a remediation, when the traffic is legitimate.\n\nSurges rarely hit one tier only: every request also publishes 0.3 jobs, so 500 req/s means 150 jobs/s, and 4 consumers drain only 100/s. Check every tier's arithmetic, and remember a backlog only shrinks when drain rate exceeds production.",
      },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "horizontal scaling", definition: "Adding more identical instances to share load." }, { term: "load shedding", definition: "Deliberately rejecting some requests to protect the system. A mitigation, not a fix for legitimate traffic." }],
    hints: [
      { level: 1, title: "Where is the queueing?", body: "Check the load figure: requests ÷ (workers × 60). Then check the queue depth trend. Db qps and cache hit ratio are normal here." },
      { level: 2, title: "Do the arithmetic, twice", body: "API: 500 ÷ 60 = 8.3 workers at full tilt, so 9+. Queue: 500 × 0.3 = 150 jobs/s produced; consumers drain 25/s each, so you need more than 6 to shrink the backlog." },
      { level: 3, title: "Do not shed legitimate traffic", body: "Rate limiting makes the dashboard green but fails the customer. Scale workers to 9+ and consumers to 7+ (8 drains comfortably)." },
      { level: 4, title: "Guided example", body: "Open Logs and Metrics (load ~208%, 503s from workers, queue depth rising), answer root cause = legitimate traffic exceeds worker and consumer capacity, scale workers to 9, restart consumers at 8, advance time until 5 healthy seconds, write the note with both capacity rules." },
    ],
    reflectionPrompts: ["Explain the tradeoff you faced between rate limiting and scaling, and how you justified the number of workers you chose."],
    transferNote: "Capacity incidents are solved with measurement and arithmetic, then verified. Interviewers ask exactly this: how did you size it, and how did you know it worked?",
    scenario: {
      initialConfig: { requestsPerSec: 500, workers: 4, cacheHitRate: 0.85, dbDegraded: false, deployInProgress: false, queueConsumers: 4 },
      initialQueueDepth: 60,
      ticket: {
        title: "INC-2057: 5xx storm after partner integration went live",
        reporter: "On-call channel",
        description: "Traffic rose from ~120 to ~500 req/s within two minutes when a partner enabled their integration. The partner's traffic is expected to stay.",
        symptoms: ["error rate ~60%", "p95 latency > 1.5 s", "worker CPU pinned", "job queue depth climbing"],
        impact: "All customers affected; new partner cannot onboard.",
      },
      allowedActions: ["scale-workers", "set-consumers", "set-cache-hit", "restart-db", "set-traffic"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "The cache hit ratio collapsed",
          "The database is degraded",
          "Legitimate traffic exceeds the capacity of the 4 API workers and the 4 queue consumers",
          "A bad deploy is in progress",
        ],
        correctIndex: 2,
        explanation: "API load is ~208% of capacity (500 ÷ 240) and the queue receives 150 jobs/s against 100 jobs/s of drain. Cache and database figures are normal.",
      },
      remediationCheck: (c) => {
        if (c.requestsPerSec < 500) return { passed: false, detail: "Rate limiting rejects a legitimate customer; restore traffic and add capacity" };
        const load = c.requestsPerSec / (c.workers * 60);
        if (load > 0.95) return { passed: false, detail: `API load is ${(load * 100).toFixed(0)}%; need ≥ 9 workers for 500 req/s` };
        const drain = c.queueConsumers * 25;
        const produced = c.requestsPerSec * 0.3;
        return drain > produced ? { passed: true } : { passed: false, detail: `queue drains ${drain}/s but receives ${produced}/s; need more than ${Math.ceil(produced / 25)} consumers` };
      },
      verifyTicks: 5,
      postmortemPrompt: "Write the note: what happened, the capacity rules (req/s per worker, jobs/s per consumer) you applied, what you changed, and how you verified recovery.",
    },
  },
  {
    id: "incident-03-dead-consumers",
    kind: "incident",
    trackId: "distributed",
    stage: 5,
    title: "Incident: the job queue is growing and nothing is draining it",
    summary: "Queue depth climbs steadily. Find why consumers vanished, restore them, and watch the backlog drain.",
    briefing: `${COMPANY_INTRO}\n\nThe nightly billing jobs are published to a queue and processed by consumer workers. Since 09:00 the queue depth has been climbing and no invoices are going out. The API itself looks fine, which is why nobody noticed for a while.`,
    objectives: [
      "Use the logs to find out what happened to the consumers",
      "Identify the root cause",
      "Restore enough consumers to drain the backlog and verify the queue returns to a healthy depth",
      "Write a post-incident note with a prevention step (memory limits, alerts on consumer count)",
    ],
    skills: ["distributed.queues", "devops.release"],
    prerequisites: ["incident-02-traffic-surge"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Queues decouple, but someone must drain them",
        body: "Producers publish 0.3 jobs per request; each consumer drains 25 jobs/s. If consumers die, the queue silently grows and the API stays green: the failure is invisible unless you alert on queue depth or consumer count. Draining a backlog takes time: depth ÷ (consumers × 25 − production rate) seconds. More consumers drain faster, but check why they died first, or they will die again.",
      },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "backlog", definition: "Jobs waiting in the queue to be processed." }, { term: "OOM kill", definition: "The kernel terminating a process that exhausted memory. Usually a leak or an undersized limit." }],
    hints: [
      { level: 1, title: "Why is nothing draining?", body: "The queue has zero consumers. The first log lines explain where they went." },
      { level: 2, title: "Cause, then capacity", body: "The consumers were OOM-killed after the deploy. Restarting them brings them back; note the prevention step for the postmortem." },
      { level: 3, title: "Drain arithmetic", body: "Production is 36 jobs/s. 2 consumers drain 50/s (net 14/s, slow); 4 drain 100/s (net 64/s). Pick enough to recover within the window and use 'Advance 10s' to skip ahead." },
      { level: 4, title: "Guided example", body: "Open Logs (OOM killed queue-worker-1/2, no consumers registered), open Metrics (queue depth rising), root cause = consumers OOM-killed, restart consumers at 4, advance time until depth < 300 and stays healthy 5s, write the note with a memory limit + consumer-count alert." },
    ],
    reflectionPrompts: ["Describe how an incident can hide behind a green API dashboard, how you found it, and what alert you would add."],
    transferNote: "Silent queue failures are common in real systems; the lesson about alerting on the thing that matters (consumers, depth) is universal.",
    scenario: {
      initialConfig: { requestsPerSec: 120, workers: 4, cacheHitRate: 0.85, dbDegraded: false, deployInProgress: false, queueConsumers: 0 },
      initialQueueDepth: 900,
      ticket: {
        title: "INC-2063: billing queue depth rising, no invoices sent since 09:00",
        reporter: "Finance team",
        description: "The invoice queue has been growing since 09:00. The API dashboards are green. The nightly deploy at 08:55 updated the queue-worker image.",
        symptoms: ["queue depth rising ~36 jobs/s", "no consumer heartbeats", "API latency and errors normal"],
        impact: "No invoices delivered; finance cannot close the day. Grows worse every minute.",
      },
      allowedActions: ["set-consumers", "scale-workers", "rollback-deploy", "restart-db"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "API workers are saturated",
          "The queue consumers were OOM-killed after the deploy and never restarted, so nothing drains the queue",
          "The database is degraded",
          "Producers are publishing too many jobs",
        ],
        correctIndex: 1,
        explanation: "The logs show both queue-workers killed by the OOM killer right after the deploy; the queue reports no consumers registered.",
      },
      remediationCheck: (c) => (c.queueConsumers >= 2 ? { passed: true } : { passed: false, detail: c.queueConsumers === 1 ? "one consumer (25 jobs/s) cannot out-pace 36 jobs/s of production" : "no consumers are running" }),
      verifyTicks: 5,
      postmortemPrompt: "Write the note: what happened, why the API stayed green, what you did, and the prevention steps (memory limit, alert on consumer count / queue depth).",
    },
  },
  {
    id: "incident-04-replica-lag",
    kind: "incident",
    trackId: "distributed",
    stage: 5,
    title: "Incident: dispatchers see positions that are a minute old",
    summary: "Writes succeed, the API is green, yet the map is stale. Find why the read replica fell behind, fix the cause without losing data, and verify freshness.",
    briefing: `${COMPANY_INTRO}\n\nAt 09:03 support escalates: dispatchers say the live map shows vehicles where they were a minute ago, although drivers' phones report positions every second. The API dashboard is green and nothing is erroring. The replication-lag alert fired two minutes ago.`,
    objectives: [
      "Use the logs to find which component is behind and what is holding it back",
      "Identify the root cause",
      "Remove the cause without discarding committed writes, mitigate staleness if you choose, and verify the replica catches up",
      "Write a post-incident note with a prevention step (statement timeouts on the replica, lag alerting)",
    ],
    skills: ["distributed.consistency", "distributed.observability"],
    prerequisites: ["incident-03-dead-consumers"],
    estimatedMinutes: 20,
    lesson: [
      ...SHARED_LESSON,
      {
        title: "Replication lag and stale reads",
        body: "Nimbus writes positions to the primary database and serves the dispatcher map from a **read replica** that replays the primary's writes. When the replica's apply thread is blocked (here by a long analytics query holding a lock on the positions table), the replica stops replaying, and its data gets older by one second every second. Writes still succeed and the API still answers quickly, so the only visible symptom is **staleness**: a consistency problem, not an availability problem.\n\nThe remedies differ in cost. Killing the blocking statement removes the cause; the replica then replays about 3 s of writes per second and catches up. Pinning map reads to the primary hides the staleness immediately but loads the primary with every map read, so it is a mitigation, not a fix. **Failing over** to a replica that is behind is the worst option: the writes it never received are gone from the new primary.",
      },
    ],
    glossary: [
      ...SHARED_GLOSSARY,
      { term: "read replica", definition: "A copy of the database that replays the primary's writes and serves reads to spread load." },
      { term: "replication lag", definition: "How far behind the primary a replica is, in seconds of writes not yet applied." },
      { term: "stale read", definition: "A read answered with data older than the application tolerates." },
      { term: "failover", definition: "Promoting a standby to primary. Safe only when the standby has every committed write." },
    ],
    hints: [
      { level: 1, title: "Green is not the same as correct", body: "Error rate, latency and load are normal. Look at the replica lag figure in Metrics and the db-replica lines in Logs." },
      { level: 2, title: "What is holding the replica back?", body: "The replica's apply thread is waiting for a lock on the positions table held by pid 8812, a long-running analytics report. Lag rises 1 s per second while it waits. The primary is healthy: it keeps committing writes." },
      { level: 3, title: "Fix the cause, keep the data", body: "Kill the blocking statement; lag then falls about 2 s per second. Pinning reads to the primary is an acceptable stop-gap, but route them back once lag is under 5 s. Do not fail over: a standby 45+ s behind would come up missing those writes." },
      { level: 4, title: "Guided example", body: "Open Logs (apply thread waiting for lock held by pid 8812; primary sending normally), open Metrics (replica lag rising, everything else normal), answer root cause = analytics query blocking the replica's apply thread, run 'Kill the statement blocking replication', advance time until lag is under 5 s and health stays healthy for 5 s, write the note with statement timeouts + lag alerting." },
    ],
    reflectionPrompts: ["Explain the difference between an availability incident and a consistency incident, and why failing over would have made this one worse."],
    transferNote: "Replication lag, stale reads and the failover trap are standard interview topics for distributed systems; the evidence path (lag metric → blocked apply thread → the statement holding the lock) is what interviewers want to hear.",
    scenario: {
      initialConfig: { requestsPerSec: 150, workers: 4, cacheHitRate: 0.85, dbDegraded: false, deployInProgress: false, queueConsumers: 2, replicaBlocked: true, readsFromPrimary: false },
      initialQueueDepth: 20,
      initialReplicaLag: 45,
      ticket: {
        title: "INC-2078: live map stale by about a minute; writes succeeding",
        reporter: "Support escalation + replication-lag alert",
        description: "Dispatchers report vehicle positions roughly a minute old. Drivers' apps confirm positions are being sent and accepted. The API dashboard is green. The replication-lag alert fired at 09:01 and is still firing.",
        symptoms: ["replica lag above 45 s and rising", "map reads served from the replica report data age in the logs", "API latency, error rate and load normal", "primary database committing writes normally"],
        impact: "Dispatch decisions are made on stale positions; no data is lost yet. Grows worse each second.",
      },
      allowedActions: ["kill-blocking-query", "route-reads-primary", "route-reads-replica", "restart-db", "scale-workers", "set-cache-hit"],
      rootCause: {
        prompt: "What is the root cause?",
        options: [
          "The primary database is failing and must be failed over",
          "The cache is serving stale entries",
          "A long-running analytics query holds a lock on positions that the replica's apply thread needs, so replication has stalled and the replica falls further behind each second",
          "API workers are too slow to serve the map",
        ],
        correctIndex: 2,
        explanation: "The replica logs name the blocked apply thread and the statement holding the lock (pid 8812); the primary reports it is committing writes and sending the replication stream normally.",
      },
      remediationCheck: (c, sim) => {
        if (sim.lostWritesSec > 0) return { passed: false, detail: `failing over promoted a standby ${sim.lostWritesSec}s behind: those writes are lost; this cannot be undone here (reset the mission)` };
        if (c.replicaBlocked) return { passed: false, detail: c.readsFromPrimary ? "pinning reads to the primary hides the staleness, but the replica is still blocked and falling behind" : c.workers > 4 ? "workers were never the bottleneck" : "the replica's apply thread is still blocked" };
        if (c.readsFromPrimary && sim.replicaLag <= 5) return { passed: false, detail: `lag is ${Math.round(sim.replicaLag)}s: route map reads back to the replica so the primary stops carrying them` };
        return { passed: true };
      },
      verifyTicks: 5,
      postmortemPrompt: "Write the note: what happened, why the API stayed green, what you did (and why you did not fail over), and the prevention steps (statement timeout on the replica, alert on replication lag, keep analytics off the serving replica).",
    },
  },
];
