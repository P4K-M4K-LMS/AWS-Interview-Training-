// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Exercises the Go runner (Yaegi compiled to WebAssembly) directly in Node
 * using Go's wasm_exec.js shim. Skipped when the artifact was not built
 * (no Go toolchain); CI builds it before running tests.
 */
const wasmPath = path.resolve("public/go/gorunner.wasm");
const shimPath = path.resolve("public/go/wasm_exec.js");
const built = existsSync(wasmPath) && existsSync(shimPath);

type GoResult = { stdout: string; stderr: string; error: string; tests: Array<{ id: string; passed: boolean; error?: string }> };

async function loadRunner(): Promise<(code: string, tests?: Array<{ id: string; code: string }>) => GoResult> {
  // wasm_exec.js installs a global `Go` class when evaluated.
  const shim = readFileSync(shimPath, "utf8");
  // eslint-disable-next-line no-new-func
  new Function(shim)();
  const g = globalThis as unknown as { Go: new () => { importObject: WebAssembly.Imports; run: (i: WebAssembly.Instance) => Promise<void> }; goRunnerReady?: boolean; goRun: (c: string, t: string) => string };
  const go = new g.Go();
  const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), go.importObject);
  void go.run(instance);
  while (!g.goRunnerReady) await new Promise((r) => setTimeout(r, 10));
  return (code, tests = []) => JSON.parse(g.goRun(code, JSON.stringify(tests))) as GoResult;
}

describe.skipIf(!built)("Go runner (Yaegi WebAssembly)", () => {
  it("runs goroutines, channels, mutexes and generics with real output, exactly once", async () => {
    const run = await loadRunner();
    const r = run(`package main
import ("fmt"; "sync")
func main() {
	var mu sync.Mutex; n := 0; var wg sync.WaitGroup
	for i := 0; i < 50; i++ { wg.Add(1); go func() { defer wg.Done(); mu.Lock(); n++; mu.Unlock() }() }
	wg.Wait()
	ch := make(chan int, 3); ch <- 1; ch <- 2; ch <- 3; close(ch)
	sum := 0; for v := range ch { sum += v }
	fmt.Println("n", n, "sum", sum)
}`);
    expect(r.error).toBe("");
    expect(r.stdout).toBe("n 50 sum 6\n");
  }, 60_000);

  it("reports compile errors with line numbers and runtime panics without crashing", async () => {
    const run = await loadRunner();
    const bad = run(`package main\nimport "fmt"\nfunc main() { fmt.Println(nope) }`);
    expect(bad.error).toMatch(/^3:\d+: undefined: nope/);
    const panic = run(`package main\nfunc main() { var s []int; _ = s[3] }`);
    expect(panic.error).toMatch(/index out of range|panic/);
    const ok = run(`package main\nimport "fmt"\nfunc main() { fmt.Println("still alive") }`);
    expect(ok.stdout).toBe("still alive\n");
  }, 60_000);

  it("runs test snippets in the program's namespace and separates their output", async () => {
    const run = await loadRunner();
    const r = run(`package main\nimport "fmt"\nfunc add(a, b int) int { return a + b }\nfunc main() { fmt.Println(add(2, 3)) }`, [
      { id: "t1", code: `if add(2, 3) != 5 { panic("expected 5") }` },
      { id: "t2", code: `if add(2, 2) != 5 { panic(fmt.Sprintf("expected 5, got %d", add(2, 2))) }` },
    ]);
    expect(r.stdout).toBe("5\n");
    expect(r.tests[0].passed).toBe(true);
    expect(r.tests[1].passed).toBe(false);
    expect(r.tests[1].error).toContain("expected 5, got 4");
  }, 60_000);
});

describe.skipIf(built)("Go runner artifact", () => {
  it("is not built in this environment (install Go and run npm run build:go)", () => {
    expect(built).toBe(false);
  });
});
