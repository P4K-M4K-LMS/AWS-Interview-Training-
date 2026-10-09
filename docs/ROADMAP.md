# Development roadmap

Status vocabulary: completed and verified · completed but unverified · partial · planned.

## Phase 1: Architecture and setup — completed and verified
Requirements captured in the master prompt; typed schemas in `src/domain/types.ts`; architecture, safety and acceptance tests documented; project builds and tests run in CI.

## Phase 2: Working app foundation — completed and verified
Navigation (11 sections), dashboard, responsive shell, IndexedDB persistence, mission engine, learner progression, skill tracking.

## Phase 3: Technical workstations — completed and verified
Terminal simulator, Python editor + Pyodide worker execution, validation rules, feedback and hints, interactive Big O visualizations.

## Phase 4: First playable missions — completed and verified
10 missions, each proven completable by automated tests (`tests/missions.test.ts`).

## Phase 5: Interview Command Center — completed; voice parts unverified
STAR tutorial, 16 LPs (wording to verify), Story Bank, guided answers, session management, rule-based feedback with disclosed limits, Dive Deeper, progress tracking.

## Phase 6: Voice integration — completed but unverified in CI
Microphone permission states, recording indicator, speech recognition with transcript review, text-to-speech, turn-taking, text fallback, optional model-powered coaching via proxy.

## Phase 7: Advanced engineering simulations — partial
Monitoring dashboard exists as a standalone simulation. Planned: incident console with investigation workflow, architecture visualizer, CI/CD pipeline missions, concurrency and queue simulations, distributed failure scenarios, reliability engineering missions.

## Phase 8: Refinement and deployment — partial
GitHub Pages workflow and CI exist. Planned: accessibility audit, lazy loading for bundle size, adaptive remediation variants, more curriculum, documentation polish.
