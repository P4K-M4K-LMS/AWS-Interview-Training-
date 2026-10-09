# OpsForge architecture

OpsForge is a single-page web application. Everything a learner needs runs in the browser; an optional Node proxy adds model-based coaching without exposing an API key to the client.

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript + Vite 8 | Fast builds, typed components, static hosting |
| Styling | Tailwind CSS v4 | Dark/light theming via CSS variables, small CSS |
| Routing | react-router (hash router) | Deep links work on GitHub Pages without rewrites |
| Persistence | IndexedDB via Dexie 4 | Structured local storage with live queries |
| Code editor | CodeMirror 6 | Lightweight Python highlighting |
| Python | Pyodide (CPython 3.14 compiled to WebAssembly) in a Web Worker | Real execution, isolated from the UI thread, killable on timeout |
| Terminal | Custom deterministic simulator | Safe, inspectable state for validation; no host shell |
| Tests | Vitest (unit, Node + jsdom) and Playwright (e2e) | Engines tested in Node; acceptance criteria tested in a real browser |
| Optional coaching | Node HTTP server + `@anthropic-ai/sdk` | Keeps the key server-side; falls back to rules |

## Module map

```
src/
  domain/types.ts            Typed, versioned data models (curriculum, missions, learner, interview)
  data/db.ts                 Dexie schema, profile helpers, export/import/reset
  data/hooks.ts              Live React hooks over the database
  content/curriculum.ts      Tracks, skills, prerequisites, career stages, posting qualifications
  content/missions/*.ts      Mission definitions (worlds, checks, lessons, hints, tests)
  content/leadershipPrinciples.ts  16 LPs, practice questions, examples
  content/featureStatus.ts   Honest "what works" list shown in Settings
  engine/terminal/shell.ts   Virtual filesystem + command parser + processes/services
  engine/python/execute.ts   Pyodide execution core (shared by worker and Node tests)
  engine/python/runner.ts    Main-thread worker client with timeout/restart
  workers/python.worker.ts   The Web Worker that owns the interpreter
  engine/bigo/algorithms.ts  Instrumented algorithms, step recorder, growth tables
  engine/sim/model.ts        Platform simulation: config → metrics, queue accumulation, coherent logs
  engine/sim/incident.ts     Incident state machine: actions, inspection, root cause, recovery, checks
  engine/missions/engine.ts  Status, validation, attempts, hints, completion
  engine/learner/mastery.ts  Mastery model, spaced repetition, stage eligibility
  engine/learner/recommend.ts Next-step recommendations
  engine/interview/star.ts   Rule-based STAR analysis + gap detection
  engine/interview/diveDeeper.ts Follow-up selection, depth levels, conversation state
  engine/interview/scoring.ts Rubric, feedback report, before/after comparison
  services/voice/*           Speech recognition / synthesis wrappers + capability detection
  services/coach/index.ts    Coach adapter: rules always, Claude proxy optionally
  components/, pages/        UI
server/index.ts              Optional coaching proxy
```

## Data flow

1. **Content** is static TypeScript. Missions contain pure validation functions that inspect simulator state, so content never needs to be stored.
2. **Learner state** (profile, skill states, mission progress, stories, interview sessions, activity, study days) lives in IndexedDB. React pages subscribe with `useLiveQuery`, so every page reflects the database immediately.
3. **Missions**: a player component builds a workstation (shell, Python runner or Big O lab), runs the mission's checks after every action, saves a snapshot for resume, and calls `completeMission` only when all checks pass. Completion applies `applyMissionCompletion` to each exercised skill (hint and attempt penalties, independent-solve bonus, spaced-repetition scheduling) and may promote the career stage.
4. **Interview sessions** are state machines persisted after every turn. `createDiveDeeperState` analyses the first answer; `nextFollowUp` picks the most important unresolved gap and depth level; `applyFollowUpAnswer` re-analyses the combined transcript and marks gaps resolved or accepts "I don't know". Feedback is produced by the coach adapter.

## Persistence and privacy

- All data is local to the browser profile. Export/import produces a versioned JSON bundle; `validateBundle` rejects other apps or schema versions.
- No network calls are made by default. The only outbound call is to the coaching proxy, and only when the learner selects Claude coaching, enters a URL and ticks consent. Audio is never sent anywhere by OpsForge; browser speech recognition may use the browser vendor's service, and Settings says so.
- Schema changes bump `SCHEMA_VERSION` and add a Dexie `version(n).upgrade()`.

## Safety

- Learner Python runs in a Web Worker inside WebAssembly. It has no access to the page, the filesystem or the network, and the main thread terminates the worker after 10 seconds.
- The terminal is a simulation. Unsupported commands return `command not found` and say so; `help` documents the subset.
- The proxy never embeds keys in the client; the client sends transcripts only, size-limited and CORS-restricted by `COACH_ALLOWED_ORIGIN`.
- Interview feedback discloses its limits in every report (`limitations`), never fabricates delivery metrics without a real recording, and never invents answer content.

## Extending

- Add a mission: create it in `src/content/missions/<track>.ts` with four hints (the level-4 hint must be a runnable guided example, which the test suite executes), then add it to `RECOMMENDED_ORDER`.
- Add a terminal command: implement it in `Shell.dispatch` and document it in `COMMAND_DOCS`; add a test.
- Add a coach engine: implement `getFeedback` branch in `services/coach/index.ts` returning a `FeedbackReport`.
