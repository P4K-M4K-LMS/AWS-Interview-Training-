# OpsForge build session: compact reference (2026-10-08/09)

Resume-from-here summary of the session that built OpsForge: Engineer in Training. Pair with `STATUS.md` (live feature status) and `docs/TESTING_REPORT.md` (latest verified numbers).

## Outcome in one paragraph

From an empty repository to a deployed, tested web application: a Linux/Python/Go/Big O engineering simulator with 20 verified-completable missions, an incident console on a shared platform simulation, a CI/CD pipeline runner, and an Amazon/AWS interview coach with STAR Academy, all 16 verified Leadership Principles, a story bank, voice input, Dive Deeper probing and transparent scoring. Live at https://paukennick.github.io/AWS-Interview-Training-/ (GitHub Pages, auto-deploys from `main`).

## Pull requests (merged into `main` on the owner's word)

| PR | Content |
|---|---|
| #1 | MVP: scaffold, terminal simulator, Python lab (Pyodide), Big O lab, 10 missions, adaptive learning, Interview Command Center, voice, Claude proxy, docs |
| #2 | Leadership Principle wording verified by the owner against amazon.jobs; interview cues added per principle |
| #3 | Retention checks: fresh replay of a completed mission without hints, spaced-repetition mastery updates |
| #4 | Phase 7a: shared simulation engine, incident console, 3 incident missions, architecture visualizer; mission-availability lock bug fixed |
| #5 | CI/CD failure-mode missions (flaky test, bad release rollback, secret wiring); mission-specific terminal tools; `sed` fixed to POSIX semantics |
| #6 | Go Laboratory: Yaegi interpreter compiled to WebAssembly, worker with timeout, Node + browser tests |
| #7 | Code missions generalized by language; four Go missions (config parser, worker pool, timeouts/context, retries + idempotency) |
| #8 | Replication-lag scenario: read replica on the shared engine, stale reads, blocked apply thread, failover data-loss trap; incident mission 4 |
| #9 | Go race-detector service (`server/race.ts`, local, `go build -race`), race panel in the Go Lab and Go missions, data-race mission (double spend) |
| #10 | Five missions for the thin tracks: disk full, runaway process (Linux), cron persistence / reverse shell (security), CSV→JSON report (Python), hash tables vs lists (Big O); shell gains virtual file sizes, `truncate`, and established connections in `ss` |
| #11 | Target roles: the original posting and the SDE II Lambda/Serverless posting (pasted by the owner) as selectable roles; qualification gap map with honest coverage labels; role picker at onboarding and in Settings; dashboard panel |
| #12 | Serverless track G on the shared engine: function concurrency/throttling, cold starts/provisioned concurrency, poison messages/DLQ, retries/idempotency; three incidents + an idempotent-handler Python mission; the AWS-products qualification moves from planned to partly covered |
| #13 | Design-exercise mission type (`kind: "design"`): components with cost/capacity/latency/failure modes, a transparent rubric that computes consequences, sizing ranges, design-dependent failure drills and a structural justification check; first exercise: position ingest + map read path |
| #14 | Lesson mission type (`kind: "lesson"`) with the Agile/Scrum lesson, scenario quiz and interview cue; `devops.agile` skill; Agile practice question in the general interview pool; the serverless role's Agile/Scrum qualification moves from planned to partly covered |
| #15 | Reorganisation part 1 (option B, plain names): navigation in three groups (Learn: Today, Curriculum, Missions; Practise: Labs, Interview; You: Progress, Settings), a Labs hub with tabs, old addresses redirect, Today trimmed to the next action, activity moved to Progress, heavy pages lazy-loaded |
| #17 | Deploy resilience: one automatic reload when a page chunk fails to load after a deploy, and a readable route error page with Reload (reported by the owner as "not loading" right after the part-2 deploy) |
| #16 | Reorganisation part 2: Curriculum page with two lenses (by track: expandable tracks with skills, evidence, ordered missions and the lab; by target role: the gap map), per-track skill panels moved out of Progress, lab link on every mission, What-next panel after completion, reflections saved as draft stories marked as practice |

Feature branches still exist on GitHub (`ccr-221527a4-xf3zs7`, `lp-verified-interview-cues`, `retention-checks`, `phase7-incidents`, `cicd-failure-modes`, `go-runner-spike`); this environment cannot delete remote branches, so delete them from the Branches page.

## Decisions made with the owner

- Stack: React 19 + TypeScript + Vite 8 + Tailwind v4, Dexie/IndexedDB, CodeMirror 6, hash routing. Deployment: local dev + GitHub Pages. One draft PR per slice, merged on the owner's word.
- Coaching: rule-based engine always on; optional Claude coaching via a local proxy (`server/index.ts`) with the API key server-side and explicit consent in Settings.
- Job postings: only qualifications as provided are used; no title or responsibilities are invented. Two target roles exist (the original posting and the SDE II Lambda/Serverless posting the owner pasted on 2026-10-09); credentials, tenure and clearance are labelled not addressable.
- Go: in-browser via Yaegi compiled to WebAssembly (chosen over a backend runner so the Pages site stays self-contained). Known limit: single-threaded WebAssembly, so bare data races do not reproduce; the optional local race-detector service (`npm run race-server`, needs Go + a C compiler) fills that gap.
- Mission availability depends only on prerequisite missions; skill mastery gates stage promotion (the earlier skill-gate rule could lock a mission behind the skill it teaches).

## How it works (where to look)

- `src/domain/types.ts`: typed models. `src/data/db.ts`: IndexedDB schema, export/import/reset.
- `src/engine/terminal/shell.ts`: virtual Linux (48 commands, pipes, redirection, permissions, sudo, services, journal, simulated network tools, mission programs via `world.programs`).
- `server/race.ts` + `server/race-core.ts`: optional local race-detector service; `src/services/race` is its client; `src/components/RaceDetectorPanel.tsx` the UI.
- `src/engine/python/*` + `src/workers/python.worker.ts`: Pyodide in a worker, 10 s kill switch. `src/engine/go/runner.ts` + `src/workers/go.worker.ts` + `go/runner/main.go`: Yaegi in a classic worker; built by `scripts/build-go-runner.mjs` into `public/go/` (gitignored; CI installs Go 1.24).
- `src/engine/sim/*`: platform simulation (load, cache, database capacity, queue accumulation, logs) and the incident state machine. `src/engine/cicd/pipeline.ts`: pipeline runner and the `ci` program.
- `src/engine/learner/*`: mastery, spaced repetition, retention checks, recommendations. `src/engine/missions/engine.ts`: status, attempts, hints, completion.
- `src/engine/design/evaluate.ts`: design-exercise rubric (cost sum, weakest write-path capacity, read-path latency sum, SPOFs, durability, sizing ranges, design-dependent drills, structural justification). `src/components/players/DesignMissionPlayer.tsx` renders it.
- `src/engine/interview/*`: STAR analysis, gap detection, Dive Deeper follow-ups, rubric scoring. `src/content/leadershipPrinciples.ts`: 16 LPs (verified 2026-10-09).
- `src/content/missions/*`: all missions; the level-4 hint of every terminal mission is a runnable guided example that the test suite executes.

## Verification state (PR #17 head)

| Check | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | 0 errors |
| `npm run test` | 105 passed, 1 skipped placeholder |
| `npm run test:e2e` | 38 passed (19 scenarios, desktop + Pixel 5) |
| `npm run build` | succeeds |

Unverified by automation: voice recognition/synthesis (browser-only), the Claude proxy (needs a key), realistic timed interview mode UI.

## Environment constraints hit this session

- No account memory tools in the session: stored preferences could not be loaded.
- Outbound network blocked for amazon.jobs, aboutamazon.com, cdn.jsdelivr.net, github.io, share.google; npm, the Go module proxy and GitHub (through the proxy) worked.
- The GitHub proxy refuses the Pages settings API and branch deletion; Pages was enabled manually by the owner, and a `configure-pages` step was added to the workflow.
- github.io is blocked from the build environment, so the live site cannot be fetched here; deploys are verified from the workflow run and by serving the same build locally under the Pages base path.

## Open items, in order

1. Merge PR #17 (deploy resilience) when CI is green.
2. For the serverless role: role-specific technical interview questions, more design exercises.
3. Cleanup: the 22 static-component lint warnings in the architecture diagram; accessibility pass.
3. More missions per track (see `docs/CURRICULUM.md` planned list).
4. Accessibility audit; lazy-load CodeMirror and the interview pages to cut the 1.2 MB bundle.
5. Manual checks the owner can do: voice in Chrome/Edge; the Claude proxy with `ANTHROPIC_API_KEY=... npm run coach-server`.

## Commands

```bash
npm ci && npm run dev        # http://localhost:5173
npm run check                # typecheck + lint + unit tests + build
npm run test:e2e             # Playwright against the production build
npm run build:go             # rebuild the Go runtime (needs Go 1.22+)
VITE_BASE_PATH=/AWS-Interview-Training-/ npm run build   # Pages build
```
