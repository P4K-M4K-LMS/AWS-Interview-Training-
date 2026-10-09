/**
 * Single source of truth for "what works", shown in Settings → About and
 * mirrored in STATUS.md. Keep honest: verified means covered by automated
 * tests run in CI; partial means implemented with known limits; unverified
 * means implemented but only manually checked; planned means not built.
 */
export type FeatureStatus = "verified" | "partial" | "unverified" | "planned";

export const FEATURE_STATUS: Array<{ feature: string; status: FeatureStatus; note: string }> = [
  { feature: "Terminal simulator", status: "verified", note: "48 documented commands, pipes, redirection, permissions, processes, services. Unit-tested." },
  { feature: "Python execution (Pyodide)", status: "verified", note: "Real CPython 3.14 in a Web Worker with a 10s timeout. Execution core unit-tested in Node; browser worker checked end-to-end." },
  { feature: "Big O laboratory", status: "verified", note: "9 instrumented algorithms, step-through, growth tables, comparisons. Unit-tested." },
  { feature: "10 MVP missions", status: "verified", note: "3 Linux, 3 Python, 2 Big O, 1 security, 1 automation. Each verified completable by automated tests." },
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
  { feature: "Monitoring dashboard", status: "partial", note: "Deterministic simulation with controls; not yet tied to incident missions." },
  { feature: "Incident console, CI/CD, concurrency and distributed simulations", status: "planned", note: "Phase 7 scope." },
  { feature: "Mobile layout, keyboard navigation", status: "partial", note: "Responsive layout and labelled controls; e2e smoke test at phone width. Full accessibility audit pending." },
];
