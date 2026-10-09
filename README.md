# OpsForge: Engineer in Training

A browser-based engineering operations simulator and Amazon/AWS interview coach for a beginner who learns by doing.

- **Missions** on a fictional company's infrastructure: a stateful Linux terminal simulator, real Python execution (Pyodide), interactive Big O labs, a security investigation and a CI pipeline repair. Progress is earned only by demonstrated work.
- **Interview**: STAR Academy, all 16 Amazon Leadership Principles, a private Story Bank, guided/practice/realistic mock interviews with voice or text, a **Dive Deeper** interviewer that probes vague answers, and transparent coaching reports.
- Everything runs locally in the browser. Two optional local services add Claude-powered coaching (without exposing an API key) and the Go race detector (which WebAssembly cannot run).

```bash
npm ci
npm run dev          # http://localhost:5173
npm run test         # unit + engine + mission tests
npm run test:e2e     # browser acceptance tests
```

Docs: [Setup](docs/SETUP.md) · [User guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Curriculum](docs/CURRICULUM.md) · [Testing report](docs/TESTING_REPORT.md) · [Roadmap](docs/ROADMAP.md) · [Status](STATUS.md)

OpsForge is an independent training tool. It is not affiliated with or endorsed by Amazon; interview questions are practice examples, and career stages are game levels, not credentials.
