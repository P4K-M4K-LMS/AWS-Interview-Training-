# OpsForge project status

Resume-from-here document for multi-session work. Update on every phase.

**Last updated:** 2026-10-09 · branch `ccr-221527a4-xf3zs7`

## Decisions (do not re-litigate without reason)

- Stack: React 19 + TypeScript + Vite 8 + Tailwind v4, Dexie/IndexedDB, CodeMirror 6, Pyodide in a Web Worker, hash routing for GitHub Pages. See `docs/ARCHITECTURE.md`.
- Coaching: rule-based engine is the always-on default. Optional Claude coaching goes through `server/index.ts` (user's choice, 2026-10-08); the browser never holds a key.
- Deployment: local dev + GitHub Pages via `.github/workflows/pages.yml` (builds with `VITE_BASE_PATH=/<repo>/`).
- Delivery: one draft PR, one commit per phase.
- Job posting: only the qualifications in the master prompt are used; no title or responsibilities are invented.
- Pyodide is served from `public/pyodide/` (copied from node_modules at build time) because public CDNs may be unreachable; this also makes the lab work offline.

## Feature status

Legend: **verified** = automated tests pass in CI · **unverified** = implemented, manual check only · **partial** = implemented with known limits · **planned** = not built · **blocked** = cannot be done here.

### Technical MVP (Part 16)

| Item | Status | Notes |
|---|---|---|
| Functional dashboard with Continue Learning | verified | e2e test 1-2 |
| Learner profile + onboarding assessment | verified | e2e; seeds max 20 mastery |
| Persistent progress, save/resume/reset, export/import | verified | reload check in e2e; Dexie |
| Three Linux missions | verified | `tests/missions.test.ts` executes each guided solution |
| Three Python missions | verified | reference solutions pass real Pyodide tests; starter code fails |
| Two Big O missions | verified | content checks; visualizer e2e |
| One networking/security mission | verified | SSH brute-force investigation |
| One automation mission | verified | CI pipeline repair with simulated runner |
| Stateful terminal simulator | verified | 14 unit tests; 48 documented commands |
| Real Python execution | verified | Node tests + browser e2e (output, traceback, tests) |
| Automated mission validation | verified | checks inspect real state |
| Hint system (4 levels, mastery penalty) | verified (logic) / unverified (UI) | |
| Progress dashboard / Skill Progress page | verified | e2e |
| Adaptive engine: mastery, spaced repetition due dates, recommendations, stage promotion | partial | remediation variants / transfer tasks planned |

### Interview MVP (Part 16)

| Item | Status | Notes |
|---|---|---|
| STAR Academy | unverified | content page |
| 16 Leadership Principles with explanations + ≥1 question each | partial | 3 questions each. **Official wording unverified**: amazon.jobs was unreachable from the build environment; header in `src/content/leadershipPrinciples.ts` and the UI say so. Action: compare against the live page and correct. |
| Guided STAR answer builder | unverified | guided mode UI |
| Personal Story Bank (CRUD, tags, export/import) | verified | e2e create + list |
| Spoken questions (speech synthesis) | unverified | browser-dependent; cannot run in CI |
| Microphone recording + transcription | unverified | Web Speech API, Chrome/Edge; permission states handled; cannot run in CI |
| Editable transcripts | unverified | transcript textarea before submit |
| Text fallback | verified | e2e uses it |
| STAR feedback (rule-based) | verified | 8 unit tests |
| Dive Deeper follow-up flow | verified | unit + e2e |
| Saved practice history + improvement tracking | verified | e2e |
| Realistic timed mode | unverified | implemented; not covered by e2e |
| Claude semantic coaching proxy | unverified | needs an API key; not exercised here |
| Delivery metrics from recordings | partial | timing + transcript only; never fabricated |

### Later phases

| Item | Status |
|---|---|
| Monitoring dashboard (deterministic simulation) | partial (standalone page, not tied to missions) |
| Incident management console | planned |
| System architecture visualizer | planned |
| CI/CD, concurrency, high-throughput, distributed-failure simulations | planned |
| Remaining track content (see docs/CURRICULUM.md) | planned |
| Full accessibility audit | planned (skip link, labels, keyboard nav exist) |

## Known limitations

- The terminal is a simulation: no globbing, loops, functions or package managers.
- The rule-based coach matches linguistic cues; it cannot judge truth or technical correctness and says so in every report.
- Voice features depend on the browser and were only checked manually in design; CI cannot exercise microphones.
- Leadership Principle wording needs a manual check against amazon.jobs.

## Next steps (in order)

1. Verify LP wording against amazon.jobs; mark verified in the file header.
2. Add retention-check mode to missions (`?retention=1` currently just opens the mission).
3. Phase 7: incident console + monitoring tied to missions; distributed systems simulations.
4. More missions per track (see CURRICULUM.md).
5. Accessibility audit with a screen reader; reduce bundle size by lazy-loading CodeMirror and the interview pages.
