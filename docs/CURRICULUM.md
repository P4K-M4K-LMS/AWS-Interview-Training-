# Curriculum roadmap

## Target roles and posting alignment

The learner picks a target role at onboarding (changeable in Settings). Each role is a job posting quoted as provided in `src/content/roles.ts`; every qualification is mapped to the skills that measure progress toward it, with an honest coverage label: **trainable**, **partly covered**, **planned (not built)** or **not addressable** (degree, tenure, clearance). The Learning Paths page renders the gap map from demonstrated mastery; the Dashboard names the weakest trainable qualification and an available mission that builds it.

| Role | Source | Not addressable | Planned |
|---|---|---|---|
| Target posting (title not provided), the default | Qualifications from the master build prompt | none | regex/automation Python missions |
| System Development Engineer II, Lambda/Serverless (ADC Serverless, Seattle, updated 09/19/2026) | Posting text pasted by the owner on 2026-10-09 (description truncated) | degree/CSSLP, 2+ years experience, TS/SCI clearance | AWS products (simulated serverless track), Agile/Scrum (lesson + interview cue) |

| Track | Default role | SDE II Serverless role | Skills |
|---|---|---|---|
| A. Linux Fundamentals and Administration | Learner priority; underpins automation and troubleshooting | Systems engineering fundamentals (operating systems) | navigation, files, reading, pipes, env, permissions, processes, services, logs, performance, scripting |
| B. Python Programming | Basic qualification (modern language); preferred (Python scripting) | Modern language (Python; Go on track F) | basics, control, functions, collections, errors, files, data (JSON/CSV), regex, testing, automation, OOP, async |
| C. Data Structures, Algorithms and Big O | Learner priority; supports high-throughput reasoning | Supporting: scaling and throughput reasoning | thinking, bigo, search, sorting, structures, recursion, trees/graphs, optimization |
| D. Networking and Defensive Security | Basic qualification alternative (CND/GSEC foundations, not equivalence) | Systems engineering fundamentals (networking) | addressing, dns/ports, http, troubleshooting, authz, hardening, logs, incident |
| E. Automation, DevOps and Monitoring | Basic qualification (automation tools for build/test/release/monitor) | Supporting: reliability practices behind the design qualification; preferred: Agile/Scrum (lesson) | git, testing, cicd, config, containers, monitoring, release, agile |
| F. Concurrency and Distributed Systems | Preferred qualifications (concurrent/high-throughput; distributed systems) | Designing/architecting for reliability and scaling; distributed systems at scale | architecture, concurrency, queues, performance, scaling, resilience, consistency, observability |
| G. Serverless and Event-Driven Systems | Supporting: event-driven designs | Preferred: building services with managed function platforms (concepts only, simulated; not AWS experience) | functions, scaling (concurrency/cold starts), events (retries/DLQ), idempotency, observability |

Nothing here claims to satisfy a degree, certification, tenure or clearance requirement, and no job title or responsibility is invented.

## Explanation levels and primers

Learners on the unnamed-role posting (`ops-automation`) are new to engineering, so every mission carries a **primer** (`src/content/primers.ts`) that comes before the lesson's how:

- **In plain words**: what the thing is, in everyday language with an analogy where it helps; no code spans by rule.
- **Why it matters**: what breaks in real work, or what an interviewer is probing, if you skip it.
- **Why this way**: why these steps beat the obvious alternative (retrying, skipping, adding capacity, pasting the secret).
- **Why start here**: one sentence beside the hint ladder on why the first step is the first step.

The explanation level is `beginner` (primer expanded, first-step note always shown) or `standard` (primer collapsed under "Start from the basics", first-step note after hint 1). The default follows the target role: beginner for the unnamed role, standard for the SDE II posting. `settings.explanationLevel` overrides it (Settings → Explanations). `tests/primers.test.ts` enforces one primer per mission, minimum lengths, plain words without code, and that every "why" grounds the lesson in work or interviews.

## Career stages (game levels)

1. Engineering Trainee
2. Junior Operations Engineer: linux.navigation, linux.files, linux.reading, python.basics, python.control, algorithms.bigo at 60%
3. Systems Troubleshooter: linux.pipes, linux.permissions, linux.processes, linux.logs, python.functions, python.collections, netsec.authz
4. Automation Engineer: python.errors, python.files, python.data, python.testing, python.automation, devops.git, devops.testing
5. Reliability & Security Engineer: netsec.hardening, netsec.logs, netsec.incident, devops.cicd, devops.monitoring, linux.services
6. Distributed Systems Engineer: distributed.concurrency, queues, performance, scaling, resilience

## Mission progression (implemented)

| # | Mission | Track | Prereq | Skills |
|---|---|---|---|---|
| 1 | Find your way around the server | Linux | – | navigation, files |
| 2 | Your first script: an uptime report | Python | – | basics, functions |
| 3 | Log detective | Linux | 1 | reading, pipes, logs |
| 4 | How work grows: O(1), O(n), O(n²) | Algorithms | – | thinking, bigo |
| 5 | Parse a log with loops and dicts | Python | 2 | control, collections |
| 6 | Locked out: permissions and services | Linux | 3 | permissions, services, processes |
| 7 | Who is knocking? Failed SSH logins | Net/Sec | 3 | dns-ports, authz, logs, hardening |
| 8 | Harden a config loader (errors + tests) | Python | 5 | errors, testing |
| 9 | Logarithms and sorting | Algorithms | 4 | search, sorting, optimization |
| 10 | The build is red: repair a CI pipeline | DevOps | 6 | git, testing, cicd, permissions |
| 11 | Green on my laptop, red in CI: fix a flaky test properly | DevOps | 10 | testing, cicd |
| 12 | Bad release: roll back fast, then fix forward | DevOps | 11 | release, monitoring |
| 13 | Deploy cannot authenticate: fix the secret wiring | DevOps | 12 | config, authz |
| 14 | Incident: positions API slow after the deploy (cache stampede) | DevOps | 10 | monitoring, architecture |
| 15 | Incident: capacity exhausted during a traffic surge | Distributed | 14 | performance, scaling |
| 16 | Incident: the job queue is growing (dead consumers) | Distributed | 15 | queues, release |
| 21 | Incident: dispatchers see positions that are a minute old (replication lag) | Distributed | 16 | consistency, observability |
| 22 | A double spend: data races, critical sections and the race detector | Distributed (Go) | 20 | concurrency, resilience |
| 23 | Disk full: find what is eating the space and free it safely | Linux | 6 | performance, logs |
| 24 | Runaway process: find what is burning the CPU and stop it properly | Linux | 23 | processes, performance |
| 25 | Persistence: a cron job that phones home | Net/Sec | 7, 24 | logs, incident, hardening |
| 26 | From CSV to JSON: a fuel-efficiency report | Python | 8 | data, collections |
| 27 | Pick the right structure: hash tables vs lists | Algorithms | 9 | structures, optimization |
| 28 | Incident: the positions function is throttling under a traffic surge | Serverless | 15 | functions, scaling, observability |
| 29 | Incident: billing events pile up behind poison messages | Serverless | 28 | events, observability, queues |
| 30 | Incident: customers charged twice after function timeouts | Serverless | 29 | idempotency, events, resilience |
| 31 | Write an idempotent event handler | Serverless (Python) | 30, 26 | idempotency, errors |
| 32 | Design exercise: the vehicle-position ingest and map read path | Serverless (design) | 29 | architecture, scaling, serverless scaling/events |
| 33 | Agile and Scrum for an operations engineer (lesson + scenario quiz) | DevOps (lesson) | 10 | agile |
| 17 | Go for a Python engineer: a config parser with real error values | Distributed (Go) | 8 | python.basics, architecture |
| 18 | A worker pool: goroutines, channels and WaitGroups | Distributed (Go) | 17 | concurrency, queues |
| 19 | Timeouts and cancellation with context and select | Distributed (Go) | 18 | resilience, concurrency |
| 20 | Retries with backoff, and idempotency keys | Distributed (Go) | 19 | resilience, queues |

## Planned missions (not built)

- Linux: cron job gone wrong; writing a backup script.
- Python: regex log extractor; API client with retries; unit-test a buggy module; async fetcher.
- Algorithms: recursion and stack depth; BFS over a service graph.
- Net/Sec: firewall triage; web log anomaly hunt; hardening checklist.
- Serverless: API throttling and client backoff; scheduled functions and cost; more design exercises (billing pipeline, multi-region read path).
- DevOps: alert that never fired; container that will not start; dependency pin drift.
- Distributed: cache invalidation; select-based pipeline stage.

## Assessment and progression rules

- Mastery only changes through missions, independent solves, retention checks and the initial assessment (max 20).
- Completion gain = 35 × score × (1 − 0.15 per hint level − 0.05 per attempt beyond 2), + 10 for an independent solve, scaled by remaining headroom.
- Retention: +8 on success (interval doubles, max 60 days), −12 on failure (interval resets to 1 day).
- A mission is available when its prerequisite missions are complete. Skill prerequisites inform the curriculum map and stage promotion; they never lock a mission.
