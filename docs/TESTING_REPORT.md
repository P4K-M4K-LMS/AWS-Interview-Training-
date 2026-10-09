# Testing report

Executed on 2026-10-09 (updated after the CI/CD failure-mode missions) in the build environment (Linux, Node 22.22, Chromium 1194 via Playwright 1.64). Every number below comes from a real run; nothing is estimated.

## Commands

```
npm run typecheck   # tsc -b                      -> 0 errors
npm run lint        # oxlint                      -> 0 errors, 11 warnings (React fast-refresh / effect style; no behaviour impact)
npm run test        # vitest run                  -> 8 files, 65 tests passed
npm run build       # vite build                  -> dist/ 15 MB incl. Pyodide runtime; app JS 1.2 MB (390 kB gzip)
npm run test:e2e    # playwright test             -> 20 passed (10 scenarios × desktop + Pixel 5), 0 failed
```

## Unit and engine tests (Vitest)

| File | Tests | What is verified |
|---|---|---|
| `tests/shell.test.ts` | 15 | tokenizer; navigation; cat/grep/pipes/redirection; mkdir/touch/mv/cp/rm; permissions, chmod, sudo; env expansion; ps/top/kill affecting services; systemctl with config validation and journal; unsupported commands return 127 with guidance; snapshot/restore; validator context; editor action; simulated ping/curl/dig/ss; sed with POSIX basic-regex semantics and per-line substitution |
| `tests/python-execute.test.ts` | 6 | real CPython (Pyodide 3.14) stdout capture; real tracebacks with exception type; test cases in learner namespace; isolation between runs; stdin to input(); tests skipped when the program itself fails |
| `tests/bigo.test.ts` | 5 | growth ratios match classes (linear ≈10×, binary <25 ops at 1M, bubble >50× for 10×n, constant flat); exponential cap; step recording only for small n; sorts produce sorted output; theoretical reference for every algorithm |
| `tests/missions.test.ts` | 14 | catalogue counts (3 Linux, 3 Python, 2 Big O, 1 security, 4 CI/CD, 3 incidents); all skills/prereqs exist; every mission in the recommended order becomes available in sequence; every terminal/investigation mission starts unsolved and is solved by executing its level-4 guided example; every Python mission's starter fails and reference solution passes all tests |
| `tests/cicd.test.ts` | 5 | pipeline parsing (env, steps, comments); `ci` program stops at the first failing step, writes the log, reports status; flaky-test mission: retry fails, skipping makes CI green but fails the mission checks; secret-wiring mission: pasted token refused by secret scanning, reference fix passes; rollback mission: sudo required, unknown release rejected, metrics follow the live release, deploy log appended |
| `tests/incidents.test.ts` | 8 | simulation reacts coherently to each lever; queue accumulates and drains; logs carry evidence; every incident opens unhealthy with unmet checks; cache stampede solved only by re-warming the cache (workers/traffic shedding rejected); traffic surge solved only by sizing both workers and consumers; dead consumers solved by restarting enough consumers; out-of-runbook actions ignored and the recovery timer resets on every action |
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
| cicd | Unlock via Settings import; `ci log`, `ci run` (retry fails), inspect the test, `sed` the local-time call to UTC, `ci run` green, answer the retry question, 6/6 checks, complete | passed |
| incident | Import a progress bundle via Settings to unlock the incident; console opens unhealthy; logs show the cache expiry evidence; metrics and diagram render; correct root cause; re-warm cache; advance; health turns healthy; note written; 5/5 checks; complete | passed |

## Not verified (honest gaps)

- **Voice** (microphone permission flows, speech recognition, text-to-speech, transcript correction, cancellation): implemented against the Web Speech API with explicit states, but headless CI cannot grant a microphone or run a recognizer. Status: unverified; manual test plan in `docs/USER_GUIDE.md` (Interview section).
- **Claude coaching proxy**: requires an API key; not exercised. The fallback path (proxy unreachable → rule-based report with a note) is exercised implicitly because e2e runs with rules mode.
- **Realistic timed mode** and **guided builder UI**: implemented, not covered by e2e.
- **Accessibility**: labels, roles, skip link and keyboard navigation exist; no screen-reader audit was performed.
- **Offline fallback**: the app has no service worker; it works offline only if already cached by the browser.

## Skipped

None of the written tests are skipped.
