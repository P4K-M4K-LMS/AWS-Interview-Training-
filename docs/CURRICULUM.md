# Curriculum roadmap

## Tracks and posting alignment

| Track | Supports | Skills |
|---|---|---|
| A. Linux Fundamentals and Administration | Learner priority; underpins automation and troubleshooting | navigation, files, reading, pipes, env, permissions, processes, services, logs, performance, scripting |
| B. Python Programming | Basic qualification (modern language); preferred (Python scripting) | basics, control, functions, collections, errors, files, data (JSON/CSV), regex, testing, automation, OOP, async |
| C. Data Structures, Algorithms and Big O | Learner priority; supports high-throughput reasoning | thinking, bigo, search, sorting, structures, recursion, trees/graphs, optimization |
| D. Networking and Defensive Security | Basic qualification alternative (CND/GSEC foundations, not equivalence) | addressing, dns/ports, http, troubleshooting, authz, hardening, logs, incident |
| E. Automation, DevOps and Monitoring | Basic qualification (automation tools for build/test/release/monitor) | git, testing, cicd, config, containers, monitoring, release |
| F. Concurrency and Distributed Systems | Preferred qualifications (concurrent/high-throughput; distributed systems) | architecture, concurrency, queues, performance, scaling, resilience, consistency, observability |

Nothing here claims to satisfy a degree or certification requirement, and no job title or responsibility is invented.

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

## Planned missions (not built)

- Linux: runaway process and CPU investigation; disk full; cron job gone wrong; writing a backup script.
- Python: JSON/CSV report generator; regex log extractor; API client with retries; unit-test a buggy module; async fetcher.
- Algorithms: hash table vs list for lookups; recursion and stack depth; BFS over a service graph.
- Net/Sec: firewall triage; suspicious cron; web log anomaly hunt; hardening checklist.
- DevOps: alert that never fired; container that will not start; dependency pin drift.
- Distributed: race condition in a worker; retry storm and idempotency; replication lag; cache invalidation.

## Assessment and progression rules

- Mastery only changes through missions, independent solves, retention checks and the initial assessment (max 20).
- Completion gain = 35 × score × (1 − 0.15 per hint level − 0.05 per attempt beyond 2), + 10 for an independent solve, scaled by remaining headroom.
- Retention: +8 on success (interval doubles, max 60 days), −12 on failure (interval resets to 1 day).
- A mission is available when its prerequisite missions are complete. Skill prerequisites inform the curriculum map and stage promotion; they never lock a mission.
