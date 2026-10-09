// @vitest-environment node
import { describe, expect, it } from "vitest";
import { executeJs } from "../src/engine/js/execute";
import { deepEqual, inspect } from "../src/engine/js/inspect";

const run = (code: string, tests: Array<{ id: string; code: string }> = []) => executeJs({ id: "t", code, tests });

describe("inspect and deepEqual", () => {
  it("formats values like a console", () => {
    class Truck {
      id = "T-1";
    }
    expect(inspect("top")).toBe("top");
    expect(inspect([1, "a", null, undefined])).toBe("[ 1, 'a', null, undefined ]");
    expect(inspect({ a: 1, "b-c": [2] })).toBe("{ a: 1, 'b-c': [ 2 ] }");
    expect(inspect(new Map([["k", 1]]))).toBe("Map(1) { 'k' => 1 }");
    expect(inspect(new Set([1, 2]))).toBe("Set(2) { 1, 2 }");
    expect(inspect(new Truck())).toBe("Truck { id: 'T-1' }");
    expect(inspect(function named() {})).toBe("[Function: named]");
    expect(inspect(Truck)).toBe("[class Truck]");
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(inspect(loop)).toBe("{ self: [Circular] }");
    expect(inspect(-0)).toBe("-0");
  });

  it("compares structurally, including prototypes, Maps, Sets and NaN", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(new Map([[1, { x: 1 }]]), new Map([[1, { x: 1 }]]))).toBe(true);
    expect(deepEqual(new Set([{ x: 1 }]), new Set([{ x: 1 }]))).toBe(true);
    class A {}
    expect(deepEqual(new A(), {})).toBe(false);
  });
});

describe("executeJs, script mode", () => {
  it("captures console output by level and runs tests against top-level bindings", async () => {
    const r = await run("const answer = 42;\nconsole.log('hello', { n: 1 });\nconsole.warn('careful');", [
      { id: "a", code: "assertEqual(answer, 42)" },
      { id: "b", code: "assertEqual(answer, 41, 'off by one')" },
    ]);
    expect(r.logs).toEqual([
      { level: "log", text: "hello { n: 1 }" },
      { level: "warn", text: "careful" },
    ]);
    expect(r.tests.map((t) => t.passed)).toEqual([true, false]);
    expect(r.tests[1].error).toBe("AssertionError: off by one: got 42, expected 41");
  });

  it("runs in strict mode with top-level await", async () => {
    const r = await run("function who() { return this; }\nconst v = await Promise.resolve(7);\nconsole.log(typeof who(), v);");
    expect(r.error).toBeNull();
    expect(r.logs[0].text).toBe("undefined 7");
  });

  it("reports a runtime error with the learner's line number and skips the tests", async () => {
    const r = await run("const a = 1;\nconst b = 2;\nnull.boom;", [{ id: "x", code: "assert(true)" }]);
    expect(r.errorType).toBe("TypeError");
    expect(r.errorAt).toBe("line 3");
    expect(r.tests[0].error).toMatch(/^Not run/);
  });

  it("reports a syntax error without running anything", async () => {
    const r = await run("console.log('never');\nconst = 3;");
    expect(r.errorType).toBe("SyntaxError");
    expect(r.error).toMatch(/could not be parsed/);
    expect(r.logs).toEqual([]);
  });

  it("waits for timers in the event loop's order and reports errors thrown in callbacks", async () => {
    const r = await run(
      "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\n(async () => { console.log('E'); await null; console.log('F'); })();\nconsole.log('G');\nsetTimeout(() => { null.x; }, 5);",
      [{ id: "order", code: "assertEqual(logs(), ['A', 'E', 'G', 'C', 'F', 'B'])" }],
    );
    expect(r.tests[0]).toMatchObject({ passed: true });
    expect(r.logs.some((l) => l.level === "error" && /^Uncaught TypeError/.test(l.text))).toBe(true);
  });

  it("cancels intervals left running and says so", async () => {
    const r = await run("let n = 0; setInterval(() => n++, 10);");
    expect(r.logs.at(-1)).toEqual({ level: "warn", text: "1 timer still pending at the end of the run was cancelled." });
  });

  it("fetch reaches only the simulated API, which answers asynchronously and logs calls", async () => {
    const r = await run(
      "const res = await fetch('https://api.fleet.example/shipments/S-101');\nconst s = await res.json();\nconsole.log(res.status, s.destination);\nconst missing = await fetch('/shipments/S-999');\nconsole.log(missing.ok, missing.status);\ntry { await fetch('https://example.org/'); } catch (e) { console.log(e.name); }",
      [{ id: "log", code: "assertEqual(fetchLog().map((c) => [c.method, c.path, c.status]), [['GET', '/shipments/S-101', 200], ['GET', '/shipments/S-999', 404]])" }],
    );
    expect(r.error).toBeNull();
    expect(r.logs.map((l) => l.text)).toEqual(["200 Bristol", "false 404", "TypeError"]);
    expect(r.tests[0].passed).toBe(true);
  });

  it("a test that never settles fails on its deadline instead of hanging", async () => {
    const r = await run("", [{ id: "hang", code: "await new Promise(() => {})" }]);
    expect(r.tests[0].error).toMatch(/did not finish within 3 s/);
  });
});

describe("executeJs, module mode", () => {
  it("loads real ES modules with imports between files and exposes namespaces to tests", async () => {
    const r = await executeJs({
      id: "m",
      files: {
        "config.js": 'export default "Nimbus";',
        "format.js": 'import NAME from "./config.js";\nexport const label = (id) => `${NAME}: ${id}`;',
        "main.js": 'import { label } from "./format.js";\nconsole.log(label("S-1"));\nexport const ready = true;',
      },
      entry: "main.js",
      tests: [{ id: "ns", code: 'assertEqual([modules["config.js"].default, modules["main.js"].ready, modules["format.js"].label("x")], ["Nimbus", true, "Nimbus: x"])' }],
    });
    expect(r.error).toBeNull();
    expect(r.logs[0].text).toBe("Nimbus: S-1");
    expect(r.tests[0].passed).toBe(true);
  });

  it("runs the same files again rather than returning a cached module", async () => {
    const files = { "main.js": "console.log('ran');" };
    const a = await executeJs({ id: "1", files });
    const b = await executeJs({ id: "2", files });
    expect([a.logs.length, b.logs.length]).toEqual([1, 1]);
  });

  it("names a missing file, a non-relative import and a cycle", async () => {
    const missing = await executeJs({ id: "1", files: { "main.js": 'import x from "./nope.js";' } });
    expect(missing.error).toMatch(/no file named nope\.js/);
    const remote = await executeJs({ id: "2", files: { "main.js": 'import x from "https://cdn.example/x.js";' } });
    expect(remote.error).toMatch(/only "\.\/file\.js" imports/);
    const cycle = await executeJs({ id: "3", files: { "a.js": 'import "./b.js";', "b.js": 'import "./a.js";' } });
    expect(cycle.error).toMatch(/circular imports/);
  });

  it("restores the globals it swapped", async () => {
    const before = globalThis.setTimeout;
    await executeJs({ id: "g", files: { "main.js": "console.log(1);" } });
    expect(globalThis.setTimeout).toBe(before);
  });
});
