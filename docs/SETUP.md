# Setup guide

## Requirements

- Node.js 22 or newer (npm 10+)
- Optional: Go 1.22 or newer, to build the Go Laboratory runtime (`npm run build:go`). Without Go the app still builds and runs; the Go Laboratory shows that its runtime is unavailable.
- A modern browser. Chrome or Edge give the best voice support; Firefox works for everything except microphone speech recognition.

## Install and run

```bash
npm ci            # or: npm install
npm run dev       # http://localhost:5173
```

The first dev/build run copies the Pyodide runtime (about 14 MB) from `node_modules/pyodide` into `public/pyodide/`, and, when a Go toolchain is present, compiles the Go runner (Yaegi interpreter, about 38 MB raw / 8 MB compressed) from `go/runner` into `public/go/`. Both folders are gitignored and regenerated automatically; set `SKIP_GO_BUILD=1` to skip the Go step. The Python Laboratory loads it once per browser and then uses the browser cache.

## Tests

```bash
npm run typecheck      # tsc -b
npm run lint           # oxlint
npm run test           # vitest: engines, missions, interview logic (~10 s; loads Pyodide in Node)
npm run test:e2e       # playwright: builds, serves, and runs acceptance checks in Chromium
npm run check          # typecheck + lint + unit tests + build
```

Playwright needs a Chromium. On a normal machine run `npx playwright install chromium` once. The config also honours `PW_CHROMIUM=/path/to/chrome`.

## Production build

```bash
npm run build          # outputs dist/
npm run preview        # serves dist/ at http://localhost:4173
```

For GitHub Pages the site must be built with the repository base path:

```bash
VITE_BASE_PATH=/AWS-Interview-Training-/ npm run build
```

`.github/workflows/pages.yml` does this automatically on every push to `main` and deploys `dist/`. Pages must use **Source: GitHub Actions** (Settings → Pages → Build and deployment). With the older "Deploy from a branch" source GitHub also runs its own Jekyll build of the raw repository root on every push, and the two deployments race: when the Jekyll one lands last the site serves an `index.html` that points at `/src/main.tsx` and shows a blank page. The workflow tries to switch the source to GitHub Actions itself; the workflow token is not allowed to, so it warns and waits two minutes before deploying so its build is the one that stays live. The owner switched the source by hand on 2026-10-09, after which the Jekyll build no longer runs and the wait is skipped.

## Study catalog build

`public/study/*.json` is generated from `tools/ascendra-catalog/` and committed. After editing `src/content/study/links.ts` or refreshing the snapshot, run:

```bash
npx tsx scripts/generate-study.mts build-catalog
```

`tests/study-catalog.test.ts` fails when the committed JSON differs from a fresh build. Lesson generation (`generate`, `review`, `validate`) runs only on a machine with `ANTHROPIC_API_KEY`, never in CI; see `docs/STUDY_GENERATION.md`.

## Optional: Claude-powered coaching proxy

The app works fully offline with the rule-based coach. To enable semantic coaching:

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # never put this in the browser
npm run coach-server                     # http://localhost:8787
```

Then in the app: Settings → Coaching engine → select Claude, enter `http://localhost:8787`, click Test, and tick the consent box. Optional environment variables: `COACH_PORT`, `COACH_MODEL` (default `claude-opus-5-5`), `COACH_ALLOWED_ORIGIN` (default `*`; set it to your app origin in production).

The proxy only ever receives transcripts (never audio) and only when consent is given. If it is unreachable, every report falls back to the rule-based engine and says so.

## Optional: Go race-detector service

The in-browser Go runtime is single-threaded and cannot reproduce data races. A second optional local service runs a program with `go build -race` on your machine and returns the detector's report to the Go Laboratory and the Go missions.

```bash
npm run race-server                      # http://127.0.0.1:8788
```

Requirements: Go 1.22+ on PATH and a C compiler (gcc or clang), because the race detector needs cgo. Then in the app: Settings → Go race detector → enter `http://localhost:8788`, click Test. The service executes the Go code it receives exactly as `go run` would, so run it only on your own machine and keep it bound to localhost (the default). Environment variables: `RACE_PORT`, `RACE_HOST` (default `127.0.0.1`), `RACE_TIMEOUT_MS` (default 60000), `RACE_ALLOWED_ORIGIN` (default `*`). The first run compiles the race runtime and takes a few seconds; later runs are cached.
