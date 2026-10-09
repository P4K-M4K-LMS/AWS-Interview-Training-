// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { goMissions } from "../src/content/missions/go";

/**
 * Proves every Go mission is completable: the starter code does not pass its
 * tests, the reference solution passes all of them, in the real WebAssembly
 * runner. Skipped when the runtime was not built (no Go toolchain).
 */
const wasmPath = path.resolve("public/go/gorunner.wasm");
const shimPath = path.resolve("public/go/wasm_exec.js");
const built = existsSync(wasmPath) && existsSync(shimPath);

type GoResult = { stdout: string; error: string; tests: Array<{ id: string; passed: boolean; error?: string }> };
let runner: ((code: string, tests: Array<{ id: string; code: string }>) => GoResult) | null = null;

async function getRunner() {
  if (runner) return runner;
  // eslint-disable-next-line no-new-func
  new Function(readFileSync(shimPath, "utf8"))();
  const g = globalThis as unknown as { Go: new () => { importObject: WebAssembly.Imports; run: (i: WebAssembly.Instance) => Promise<void> }; goRunnerReady?: boolean; goRun: (c: string, t: string) => string };
  if (!g.goRunnerReady) {
    const go = new g.Go();
    const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), go.importObject);
    void go.run(instance);
    while (!g.goRunnerReady) await new Promise((r) => setTimeout(r, 10));
  }
  runner = (code, tests) => JSON.parse(g.goRun(code, JSON.stringify(tests))) as GoResult;
  return runner;
}

describe.skipIf(!built)("Go missions are completable", () => {
  for (const m of goMissions) {
    it(`${m.id}: starter fails, reference passes`, async () => {
      const run = await getRunner();
      const tests = m.tests.map((t) => ({ id: t.id, code: t.code }));
      const starter = run(m.starterCode, tests);
      expect(starter.error, `${m.id} starter must compile: ${starter.error}`).toBe("");
      expect(starter.tests.some((t) => !t.passed), `${m.id} starter must not already pass`).toBe(true);
      const ref = run(m.referenceSolution, tests);
      expect(ref.error, `${m.id} reference raised: ${ref.error}`).toBe("");
      for (const t of ref.tests) expect(t.passed, `${m.id} ${t.id}: ${t.error}`).toBe(true);
    }, 60_000);
  }
});
