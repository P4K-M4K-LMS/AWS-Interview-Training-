# Testing report

Executed on 2026-10-09 (updated after the design-exercise mission type) in the build environment (Linux, Node 22.22, Chromium 1194 via Playwright 1.64). Every number below comes from a real run; nothing is estimated.

## Commands

```
npm run typecheck   # tsc -b                      -> 0 errors
npm run lint        # oxlint                      -> 0 errors, 11 warnings (React fast-refresh / effect style; no behaviour impact)
npm run test        # vitest run                  -> 13 files, 101 tests passed, 1 skipped (the "artifact not built" placeholder, which only runs without a Go toolchain)
npm run build       # vite build                  -> dist/ 15 MB incl. Pyodide runtime; app JS 1.5 MB (474 kB gzip)
npm run test:e2e    # playwright test             -> 32 passed (16 scenarios × desktop + Pixel 5), 0 failed
```

## Unit and engine tests (Vitest)

| File | Tests | What is verified |
|---|---|---|
| `tests/shell.test.ts` | 17 | tokenizer; navigation; cat/grep/pipes/redirection; mkdir/touch/mv/cp/rm; permissions, chmod, sudo; env expansion; ps/top/kill affecting services; systemctl with config validation and journal; unsupported commands return 127 with guidance; snapshot/restore; validator context; editor action; simulated ping/curl/dig/ss; sed with POSIX basic-regex semantics and per-line substitution; network table taken from the mission world with established connections that disappear when their process is killed; virtual sizes for large files in ls/du/df/stat, truncate -s 0 in place, and sudo not elevating a redirection |
| `tests/python-execute.test.ts` | 6 | real CPython (Pyodide 3.14) stdout capture; real tracebacks with exception type; test cases in learner namespace; isolation between runs; stdin to input(); tests skipped when the program itself fails |
| `tests/bigo.test.ts` | 5 | growth ratios match classes (linear ≈10×, binary <25 ops at 1M, bubble >50× for 10×n, constant flat); exponential cap; step recording only for small n; sorts produce sorted output; theoretical reference for every algorithm |
| `tests/missions.test.ts` | 18 | catalogue counts (5 Linux, 5 Python, 5 Go, 3 Big O, 2 security, 4 CI/CD, 7 incidents, 1 design exercise); all skills/prereqs exist; every mission in the recommended order becomes available in sequence; every terminal/investigation mission starts unsolved and is solved by executing its level-4 guided example; every Python mission's starter fails and reference solution passes all tests |
| `tests/go-missions.test.ts` | 5 | every Go mission: starter compiles but fails its tests, reference solution passes all tests in the WebAssembly runner |
| `tests/go-runner.test.ts` | 3 | Yaegi WebAssembly runner in Node: goroutines, channels, mutex, generics produce exact output once; compile errors carry line numbers and runtime panics do not crash the runtime; test snippets run in the program namespace with separated output |
| `tests/cicd.test.ts` | 5 | pipeline parsing (env, steps, comments); `ci` program stops at the first failing step, writes the log, reports status; flaky-test mission: retry fails, skipping makes CI green but fails the mission checks; secret-wiring mission: pasted token refused by secret scanning, reference fix passes; rollback mission: sudo required, unknown release rejected, metrics follow the live release, deploy log appended |
| `tests/race-service.test.ts` | 5 | race report parser (two races with goroutines, kinds and frames; clean run); real `go build -race` on this machine: toolchain probe, the data-race mission starter reports races in Withdraw/Withdrawals and the reference solution reports none with the expected output, compile errors are returned as build output (skipped without a Go toolchain; the real-detector case also needs a C compiler) |
| `tests/roles.test.ts` | 6 | two roles with a default and a safe fallback; every qualification maps only known skills, every track has an alignment line, untrainable/planned qualifications map no skills, trainable ones have at least one mission; the serverless posting is quoted (title, date, TS/SCI clearance) with degree, tenure and clearance not addressable and AWS products planned; gap map starts at zero and averages only mapped qualifications; per-qualification mastery, weakest detection and the next startable mission for the role; default role maps every qualification to missions |
| `tests/design.test.ts` | 4 | the exercise starts unsolved and the reference design passes every check with the expected cost, latency and no SPOF; option ids are unique and every drill has a valid answer for the reference; each requirement violation (capacity, SPOF on the write path, no durable buffer, in-memory broker, single-node storage, read latency, budget) fails its own check with a named reason; drill answers change with the design, sizing uses ranges, the justification check is structural (length, terms, components named) |
| `tests/incidents.test.ts` | 14 | simulation reacts coherently to each lever; serverless part: throttling equals 1 − capacity/rate with capacity = limit ÷ duration, environments warm up after a limit increase and provisioned concurrency pre-warms, poison messages eat consumer capacity without a DLQ and drain into one within seconds, timed-out invocations duplicate side effects unless the handler is idempotent and are lost with retries off, scenarios without a serverless part are untouched; queue accumulates and drains; replica lag grows while blocked, drains once unblocked, pinning reads hides staleness at the cost of primary load, and failover from a lagging standby records lost writes; logs carry evidence (incl. the blocked apply thread and data age); every incident opens unhealthy with unmet checks; cache stampede solved only by re-warming the cache (workers/traffic shedding rejected); traffic surge solved only by sizing both workers and consumers; dead consumers solved by restarting enough consumers; replication lag solved by killing the blocking statement (pin-reads-only, scaling workers and failover rejected; mitigate-then-fix-then-route-back path works); throttled function solved by a limit ≥ rate × duration (faster with provisioned concurrency; workers, a lower limit and shedding rejected); poison messages solved by a DLQ with receive count 2–5 plus consumers (consumers alone and receive count 1 rejected); duplicate charges solved by the idempotent handler (retries off and timeout alone rejected); out-of-runbook actions ignored and the recovery timer resets on every action |
| `tests/retention.test.ts` | 4 | retention check refuses non-completed missions; passing adds +8 mastery, doubles the interval and records history/activity; giving up subtracts 12 and schedules a review in one day; a due skill is recommended as a retention check on its completed mission |
| `tests/interview.test.ts` | 8 | vague answers produce ownership/technical/results gaps; complete STAR answer recognised; Dive Deeper asks targeted follow-ups, keeps original context, resolves gaps with evidence, accepts "I don't know", never repeats a gap/level, stops when sufficient or asked; scoring separates weak and strong answers with evidence and limitations; improvement only declared with stronger evidence; 16 LPs present with questions and examples |

## Browser acceptance tests (Playwright, production build)

Mapped to the nonnegotiable acceptance criteria (Part 20). Each runs on a desktop viewport and on a Pixel 5 viewport.

| Criteria | Scenario | Result |
|---|---|---|
| 1, 2 | App opens; onboarding; dashboard with Continue Learning and recommendations | passed |
| 3, 7 | Complete the first Linux mission by typing real commands; checks 3/3; completion persists across reload; skill appears in progress | passed |
| 4, 6 | Python mission: interpreter loads, correct code prints real output, tests 4/4; NameError produces real traceback plus explanation | passed |
| 5 | Algorithms lab: run binary search, step through | passed |
| 8–17 | Interview Command Center, a Leadership Principle page, Story Bank create, practice session with text input, Dive Deeper follow-up, stop and receive feedback with revised outline and limitations, history | passed |
| 18–20 | Skill progress page; Settings "what works today" feature status; mobile layout renders | passed |
| keyboard | Skip link focusable and visible on focus; desktop Tab order reaches navigation | passed |
| retention | Complete a mission, reopen with `?retention=1`: fresh environment (0/3 checks), hints disabled, confirm after redoing it, "Retention check passed" shown and evidence recorded | passed |
| go-mission | Unlock via Settings import; open the retries mission; Run tests on the starter (0/3); paste the solution; Run tests (3/3); complete | passed |
| go | Go Laboratory loads the WebAssembly runtime, runs the worker-pool starter (real output), then a program with an undefined identifier shows the compiler error and its explanation; race-detector panel is disabled and labelled when unconfigured, enabled after entering a URL in Settings, and an unreachable service produces a visible error rather than a result | passed |
| cicd | Unlock via Settings import; `ci log`, `ci run` (retry fails), inspect the test, `sed` the local-time call to UTC, `ci run` green, answer the retry question, 6/6 checks, complete | passed |
| target role | Onboarding with the serverless posting selected; dashboard shows the role panel and weakest qualification; Learning Paths shows the title, the clearance as not addressable, AWS products as planned, the language qualification as trainable with its missions; switching role via the select and via Settings persists and the dashboard follows | passed |
| incident | Import a progress bundle via Settings to unlock the incident; console opens unhealthy; logs show the cache expiry evidence; metrics and diagram render; correct root cause; re-warm cache; advance; health turns healthy; note written; 5/5 checks; complete | passed |
| design exercise | Unlock via bundle; a wrong design (VM, direct writes, single-node DB, direct reads) shows the SPOF and the 800/s capacity in the consequences panel and the checks; the reference design shows 820 and no SPOF; sizing, both drills correct for the design, justification; all checks pass; complete | passed |
| serverless incident | Unlock via bundle; console opens critical; function stats show 36 needed / limit 10 and 72% throttled; logs show Rate exceeded; diagram function node; correct root cause; limit 40 + provisioned 36; advance; healthy; note; 5/5; complete | passed |
| incident: replication lag | Unlock via bundle; console opens degraded with normal errors; logs name the blocked apply thread and data age; replica-lag stat and replica node (apply BLOCKED) render; correct root cause; kill the blocking statement; advance 30s; health healthy; note; 5/5 checks; complete | passed |

## Not verified (honest gaps)

- **Voice** (microphone permission flows, speech recognition, text-to-speech, transcript correction, cancellation): implemented against the Web Speech API with explicit states, but headless CI cannot grant a microphone or run a recognizer. Status: unverified; manual test plan in `docs/USER_GUIDE.md` (Interview section).
- **Claude coaching proxy**: requires an API key; not exercised. The fallback path (proxy unreachable → rule-based report with a note) is exercised implicitly because e2e runs with rules mode.
- **Realistic timed mode** and **guided builder UI**: implemented, not covered by e2e.
- **Accessibility**: labels, roles, skip link and keyboard navigation exist; no screen-reader audit was performed.
- **Offline fallback**: the app has no service worker; it works offline only if already cached by the browser.

## Skipped

None of the written tests are skipped.
