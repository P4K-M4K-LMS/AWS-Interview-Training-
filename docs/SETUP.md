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

`.github/workflows/pages.yml` does this automatically on every push to `main` and deploys `dist/`. Enable Pages in the repository settings with **Source: GitHub Actions** the first time.

## Optional: Claude-powered coaching proxy

The app works fully offline with the rule-based coach. To enable semantic coaching:

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # never put this in the browser
npm run coach-server                     # http://localhost:8787
```

Then in the app: Settings → Coaching engine → select Claude, enter `http://localhost:8787`, click Test, and tick the consent box. Optional environment variables: `COACH_PORT`, `COACH_MODEL` (default `claude-opus-5-5`), `COACH_ALLOWED_ORIGIN` (default `*`; set it to your app origin in production).

The proxy only ever receives transcripts (never audio) and only when consent is given. If it is unreachable, every report falls back to the rule-based engine and says so.
