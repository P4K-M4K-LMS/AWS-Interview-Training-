// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { executeInPyodide, type PyodideLike } from "../src/engine/python/execute";

let py: PyodideLike;

beforeAll(async () => {
  py = (await loadPyodide()) as unknown as PyodideLike;
}, 120_000);

describe("executeInPyodide (real CPython via Pyodide)", () => {
  it("captures stdout from real execution", () => {
    const r = executeInPyodide(py, { id: "1", code: "print('hello'); print(sum(range(5)))" });
    expect(r.stdout).toBe("hello\n10\n");
    expect(r.error).toBeNull();
    expect(r.tests).toEqual([]);
  });

  it("reports real tracebacks with the exception type", () => {
    const r = executeInPyodide(py, { id: "2", code: "x = 1\nprint(undefined_name)" });
    expect(r.errorType).toBe("NameError");
    expect(r.error).toContain("undefined_name");
  });

  it("runs test cases in the learner's namespace", () => {
    const r = executeInPyodide(py, {
      id: "3",
      code: "def add(a, b):\n    return a + b\n",
      tests: [
        { id: "t1", code: "assert add(2, 3) == 5" },
        { id: "t2", code: "assert add(2, 3) == 6, 'expected 6'" },
      ],
    });
    expect(r.tests[0].passed).toBe(true);
    expect(r.tests[1].passed).toBe(false);
    expect(r.tests[1].error).toContain("AssertionError");
  });

  it("isolates globals between runs", () => {
    executeInPyodide(py, { id: "4a", code: "leak = 42" });
    const r = executeInPyodide(py, { id: "4b", code: "print(leak)" });
    expect(r.errorType).toBe("NameError");
  });

  it("feeds stdin to input()", () => {
    const r = executeInPyodide(py, { id: "5", code: "name = input('Name? ')\nprint('Hi ' + name)", stdin: "Ada" });
    expect(r.stdout).toContain("Hi Ada");
  });

  it("does not run tests when the program itself fails", () => {
    const r = executeInPyodide(py, { id: "6", code: "raise ValueError('boom')", tests: [{ id: "t", code: "assert True" }] });
    expect(r.errorType).toBe("ValueError");
    expect(r.tests[0].passed).toBe(false);
  });
});
