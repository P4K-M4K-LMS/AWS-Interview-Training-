/**
 * Single source of truth for "what works", shown in Settings → About and
 * mirrored in STATUS.md. Keep honest: verified means covered by automated
 * tests run in CI; partial means implemented with known limits; unverified
 * means implemented but only manually checked; planned means not built.
 */
export type FeatureStatus = "verified" | "partial" | "unverified" | "planned";

export const FEATURE_STATUS: Array<{ feature: string; status: FeatureStatus; note: string }> = [
  { feature: "Terminal simulator", status: "verified", note: "49 documented commands, pipes, redirection, permissions, processes, services, simulated network table with listening sockets and connections, virtual sizes for large files. Unit-tested." },
  { feature: "Python execution (Pyodide)", status: "verified", note: "Real CPython 3.14 in a Web Worker with a 10s timeout. Execution core unit-tested in Node; browser worker checked end-to-end." },
  { feature: "Go Laboratory (Yaegi interpreter in WebAssembly)", status: "verified", note: "Real Go incl. goroutines, channels, select, sync, generics and most of the standard library, in a Web Worker with a 10s timeout. Single-threaded WebAssembly: bare data races do not reproduce (see the race-detector service). Runtime built from go/runner in CI; Node + browser tests." },
  { feature: "Big O laboratory", status: "verified", note: "9 instrumented algorithms, step-through, growth tables, comparisons. Unit-tested." },
  { feature: "27 missions", status: "verified", note: "5 Linux, 4 Python, 5 Go, 3 Big O, 2 security, 4 CI/CD, 4 incidents. Each verified completable by automated tests; shortcut fixes (retry, skip, paste a secret, shed traffic) are rejected." },
  { feature: "Persistent progress", status: "verified", note: "IndexedDB via Dexie; export/import/reset. Covered by tests and e2e reload check." },
  { feature: "Adaptive learning", status: "partial", note: "Mastery from demonstrated work, hint penalties, prerequisites, spaced-repetition due dates, retention checks (fresh replay without hints) and recommendations. Transfer-task variants are planned." },
  { feature: "STAR Academy + 16 Leadership Principles", status: "verified", note: "Official wording verified against amazon.jobs on 2026-10-09; three practice questions and an interview cue per principle. Content tests check all 16." },
  { feature: "Story Bank", status: "verified", note: "Create, edit, tag, export, import, delete. Local only." },
  { feature: "Rule-based STAR feedback and scoring", status: "verified", note: "Transparent rubric; cannot judge truth or technical correctness. Unit-tested." },
  { feature: "Dive Deeper Mode", status: "verified", note: "Gap detection, prioritised follow-ups, three depth levels, conversation state, honest stopping rules. Unit-tested." },
  { feature: "Mock interview modes", status: "partial", note: "Guided, Practice and Realistic (timed, multi-question) modes implemented; realistic mode technical follow-ups are drawn from a small pool." },
  { feature: "Voice: speech recognition + synthesis", status: "unverified", note: "Uses the browser's Web Speech API when available (Chrome/Edge best). Cannot be automated in CI; manual checks only. Text fallback always available." },
  { feature: "Delivery metrics (pace, fillers, pauses)", status: "partial", note: "Computed only from recognised transcript timing when a live recording occurred; never fabricated from text alone." },
  { feature: "Claude semantic coaching", status: "unverified", note: "Optional local proxy (server/) keeps the API key off the client. Falls back to rules when unreachable. Not exercised in CI (needs a key)." },
  { feature: "Monitoring dashboard", status: "verified", note: "Shared deterministic simulation engine (load, cache, database capacity, queue accumulation, read-replica lag and stale reads); unit-tested; drives the incident missions." },
  { feature: "Incident management console", status: "verified", note: "Ticket, metrics, logs, architecture view, runbook actions, root cause, recovery verification, post-incident note. 4 scenarios proven solvable; symptom-only fixes rejected, including failing over to a lagging replica." },
  { feature: "System architecture visualizer", status: "verified", note: "Live diagram with per-component health and traffic-weighted edges, in incidents and monitoring." },
  { feature: "CI/CD failure-mode missions", status: "verified", note: "Simulated pipeline runner and mission tools (ci, deployctl, metrics): flaky test, bad release rollback, broken secret wiring. Unit + e2e tested." },
  { feature: "Go missions (config parser, worker pool, timeouts/context, retries + idempotency, data race / double spend)", status: "verified", note: "Reference solutions proven in the WebAssembly runner; browser scenario completes a mission end to end. The double-spend race reproduces in the browser because its critical section blocks." },
  { feature: "Replication-lag scenario (read replica, stale reads, failover trap)", status: "verified", note: "Replica lag accumulates on the shared engine; the incident is solved by removing the blocking statement, pinning reads is a mitigation only, and failing over a lagging standby is rejected as data loss. Unit + e2e tested." },
  { feature: "Go race-detector service (optional, local)", status: "verified", note: "npm run race-server runs a program with go build -race on your machine and returns the detector report to the Go Laboratory and Go missions. Unit tests run the real detector on the data-race mission (starter races, reference clean); the browser UI is e2e-tested in its unconfigured and unreachable states." },
  { feature: "Mobile layout, keyboard navigation", status: "partial", note: "Responsive layout and labelled controls; e2e smoke test at phone width. Full accessibility audit pending." },
];
