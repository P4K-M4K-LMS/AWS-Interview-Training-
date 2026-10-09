# OpsForge project status

Resume-from-here document for multi-session work. Update on every phase.

**Last updated:** 2026-10-09 · branch `go-missions` (PRs #1-#6 merged; site live at https://paukennick.github.io/AWS-Interview-Training-/)

## Decisions (do not re-litigate without reason)

- Stack: React 19 + TypeScript + Vite 8 + Tailwind v4, Dexie/IndexedDB, CodeMirror 6, Pyodide in a Web Worker, hash routing for GitHub Pages. See `docs/ARCHITECTURE.md`.
- Coaching: rule-based engine is the always-on default. Optional Claude coaching goes through `server/index.ts` (user's choice, 2026-10-08); the browser never holds a key.
- Redo after completion: `redoMission` reopens a completed mission as in-progress with a fresh workstation while keeping `completedAt`, reflections and retention history; `computeStatus` treats a mission with `completedAt` as satisfying prerequisites, and `completeMission` awards mastery only once.
- Role-specific interview questions: `src/content/roleQuestions.ts`, nine per role, tied to quoted qualifications and preparing missions; surfaced in Practice (question set "Role questions"), Realistic mode's technical follow-up, Interview home and the Curriculum role lens.
- Explanation levels: every mission has a beginner primer (plain words, why it matters, why this way, why start here) in `src/content/primers.ts`; expanded for the unnamed-role track, collapsed for the SDE II track, switchable in Settings. See `docs/CURRICULUM.md`.
- Deployment: local dev + GitHub Pages via `.github/workflows/pages.yml` (builds with `VITE_BASE_PATH=/<repo>/`). The Pages source must be GitHub Actions (set by hand on 2026-10-09; the workflow token cannot change it). A branch source adds a competing Jekyll deployment of the raw repository that produces a blank site when it lands last (root cause of the 2026-10-09 "not loading" reports); the workflow detects that case and waits so its own build lands last.
- Delivery: one draft PR, one commit per phase.
- Job posting: only the qualifications in the master prompt are used; no title or responsibilities are invented.
- Pyodide is served from `public/pyodide/` (copied from node_modules at build time) because public CDNs may be unreachable; this also makes the lab work offline.
- Go runs in the browser through Yaegi (a Go interpreter) compiled to WebAssembly from `go/runner`, built by `scripts/build-go-runner.mjs` (needs a Go toolchain; CI installs Go 1.24). Decided 2026-10-09 over a backend runner so the GitHub Pages site stays self-contained; a local `go test -race` service remains an option for race-detector lessons.

## Feature status

Legend: **verified** = automated tests pass in CI · **unverified** = implemented, manual check only · **partial** = implemented with known limits · **planned** = not built · **blocked** = cannot be done here.

### Technical MVP (Part 16)

| Item | Status | Notes |
|---|---|---|
| Functional dashboard with Continue Learning | verified | e2e test 1-2 |
| Learner profile + onboarding assessment | verified | e2e; seeds max 20 mastery |
| Persistent progress, save/resume/reset, export/import | verified | reload check in e2e; Dexie |
| Five Linux missions (navigation, log detective, permissions/services, disk full, runaway process) | verified | `tests/missions.test.ts` executes each guided solution |
| Five Python missions (uptime report, log parser, config validator, CSV→JSON report, idempotent event handler) | verified | reference solutions pass real Pyodide tests; starter code fails |
| Three Big O missions (growth, search/sort, hash tables vs lists) | verified | content checks; visualizer e2e |
| Two security investigations (SSH brute force, cron persistence / reverse shell) | verified | guided solutions executed; containment checks inspect processes, files and the socket table |
| One networking/security mission | verified | SSH brute-force investigation |
| One automation mission | verified | CI pipeline repair with simulated runner |
| Stateful terminal simulator | verified | 14 unit tests; 48 documented commands |
| Real Python execution | verified | Node tests + browser e2e (output, traceback, tests) |
| Automated mission validation | verified | checks inspect real state |
| Hint system (4 levels, mastery penalty) | verified (logic) / unverified (UI) | |
| Progress dashboard / Skill Progress page | verified | e2e |
| Adaptive engine: mastery, spaced repetition due dates, retention checks, recommendations, stage promotion | partial | retention checks verified by unit tests; transfer-task variants planned |

### Interview MVP (Part 16)

| Item | Status | Notes |
|---|---|---|
| STAR Academy | unverified | content page |
| 16 Leadership Principles with explanations + ≥1 question each | verified | 3 questions and an interview cue each. Official wording verified by the owner against amazon.jobs on 2026-10-09. |
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
| Monitoring dashboard (shared simulation engine) | verified (unit tests) |
| Incident management console + 7 incident missions (cache stampede, traffic surge, dead consumers, replication lag, throttled function, poison messages, duplicate charges) | verified (unit tests prove solvable and reject symptom-only fixes, including failover from a lagging replica; e2e on incidents 1 and 4) |
| System architecture visualizer with live health | verified (e2e) |
| CI/CD failure-mode missions: flaky test, bad release rollback, secret wiring (simulated pipeline runner, mission tools) | verified (unit tests prove solvable and reject shortcuts; e2e on the flaky-test mission) |
| Go Laboratory: Yaegi-in-WebAssembly runtime, worker with timeout, free-play page | verified (Node runner tests + browser e2e) |
| Go missions: config parser (Go for a Python engineer), worker pool, timeouts/context, retries + idempotency, data race / double spend | verified (reference solutions proven in the WebAssembly runner; e2e completes one) |
| Replication-lag simulation: read replica, stale map reads, blocked apply thread, failover data-loss trap | verified (unit + e2e) |
| Go race-detector service (optional, local): `npm run race-server`, panel in the Go Laboratory and Go missions | verified (unit tests run the real detector on the data-race mission; e2e covers the UI states) |
| Remaining track content (see docs/CURRICULUM.md) | planned |
| Target roles: two postings quoted as provided, role picker at onboarding and in Settings, qualification gap map on Learning Paths, weakest-qualification panel on the Dashboard | verified (unit tests on the mapping and the gap engine; e2e picks the serverless role and reads its map) |
| Serverless track: simulated function platform on the shared engine (concurrency limit / throttling, cold starts / provisioned concurrency, poison messages / DLQ, retries / idempotency); 3 incidents + 1 Python handler mission | verified (unit tests prove each solvable and reject the symptom-only fixes; e2e on the throttled-function incident) |
| Design-exercise mission type: components with cost/capacity/latency/failure modes, computed consequences, sizing arithmetic, design-dependent failure drills, structural justification check; 1 exercise (position ingest + map read path) | verified (unit tests on the rubric; e2e completes the exercise after a wrong design first) |
| Agile/Scrum lesson mission (lesson + scenario quiz + interview cue) and an Agile practice question in the general pool | verified (content tests; e2e completes the quiz) |
| Role-specific technical interview questions, more design exercises (for the SDE II Serverless role) | planned |
| Full accessibility audit | planned (skip link, labels, keyboard nav exist) |

## Navigation (reorganised 2026-10-09, option B part 1)

Three groups with plain names: **Learn** (Today, Curriculum, Missions), **Practise** (Labs with Terminal / Python / Go / Algorithms / Security / Monitoring tabs, Interview), **You** (Progress, Settings). The old addresses (`/paths`, `/terminal`, `/python`, `/go`, `/algorithms`, `/security`, `/monitoring`) redirect. Heavy pages load on demand. Part 2 (done): one explorable **Curriculum** with a by-track lens (expandable tracks with skills, evidence, missions and the matching lab) and a by-target-role lens (the gap map); every mission links to its lab and offers the next mission on completion; mission reflections become draft stories in the Story Bank, marked as practice. Progress keeps study stats, stage, retention and activity.

## Known limitations

- Pages load on demand, so a browser that still holds the previous `index.html` right after a deploy can request chunk files that no longer exist. The app reloads once automatically when that happens and otherwise shows a readable error page with a Reload button instead of a blank page; progress is in IndexedDB and is unaffected. A hard refresh also fixes it.

- Mission availability depends only on prerequisite missions (fixed 2026-10-09: skill-prerequisite gating could lock a mission behind the skill it teaches). Skill mastery gates stage promotion.
- The terminal is a simulation: no globbing, loops, functions or package managers. Missions may ship their own tools (e.g. `ci`, `deployctl`, `metrics`), listed by `help`. Large files carry a virtual size (shown by ls/du/df/stat) without storing gigabytes of content; `truncate -s 0` empties a file in place and, like real bash, `sudo echo > FILE` does not elevate the redirection. `sed` follows POSIX basic-regex semantics (parentheses literal unless escaped) and substitutes once per line.
- Code missions are generic over language (`kind: "python" | "go"`); the player picks the runtime and editor mode. Yaegi quirk found: a `range` over a slice literal evaluated at the interpreter top level can nil-dereference, so mission test snippets avoid top-level `range`.
- The Go runtime is 37.6 MB raw (about 8 MB gzip-compressed) and is fetched only when the Go Laboratory opens. WebAssembly is single-threaded, so goroutine interleaving is cooperative: concurrency semantics are faithful; races whose critical section blocks reproduce, bare counter races do not. The optional local race-detector service (needs Go and a C compiler) covers those; it runs the submitted code on the learner's machine and is documented as such.
- The rule-based coach matches linguistic cues; it cannot judge truth or technical correctness and says so in every report.
- Voice features depend on the browser and were only checked manually in design; CI cannot exercise microphones.

## Next steps (in order)

1. For the SDE II Serverless role: role-specific technical interview questions; more design exercises.
2. More missions per track (see the planned list in CURRICULUM.md: cron/backup script, regex extractor, API client, recursion, BFS, firewall triage, web-log hunt).
3. Accessibility audit with a screen reader; reduce bundle size by lazy-loading CodeMirror and the interview pages.
