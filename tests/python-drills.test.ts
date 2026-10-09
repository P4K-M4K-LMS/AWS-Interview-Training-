// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { PYTHON_DRILLS } from "../src/content/study/pythonDrills";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { executeInPyodide, type PyodideLike } from "../src/engine/python/execute";

let py: PyodideLike;
beforeAll(async () => {
  py = (await loadPyodide()) as unknown as PyodideLike;
}, 120_000);

describe("Python drills (real CPython via Pyodide)", () => {
  it("every drill's reference solution passes every test, and its starter fails at least one", () => {
    for (const d of PYTHON_DRILLS) {
      const sol = executeInPyodide(py, { id: d.id, code: d.solution, tests: d.tests.map((t) => ({ id: t.id, code: t.code })) });
      expect(sol.error, `${d.id} solution raised`).toBeNull();
      expect(sol.tests.filter((t) => !t.passed).map((t) => `${t.id}: ${t.error}`), d.id).toEqual([]);
      const start = executeInPyodide(py, { id: `${d.id}-start`, code: d.starter, tests: d.tests.map((t) => ({ id: t.id, code: t.code })) });
      expect(start.error !== null || start.tests.some((t) => !t.passed), `${d.id} starter must not pass`).toBe(true);
      expect(d.hints.length).toBeGreaterThanOrEqual(2);
      expect(d.tests.length).toBeGreaterThanOrEqual(3);
    }
  }, 120_000);

  it("the last hint of every drill is itself a passing program", () => {
    for (const d of PYTHON_DRILLS) {
      const r = executeInPyodide(py, { id: `${d.id}-hint`, code: d.hints[d.hints.length - 1], tests: d.tests.map((t) => ({ id: t.id, code: t.code })) });
      expect(r.error, `${d.id} last hint raised`).toBeNull();
      expect(r.tests.filter((t) => !t.passed).map((t) => `${t.id}: ${t.error}`), d.id).toEqual([]);
    }
  }, 120_000);

  it("a wrong answer fails with the interpreter's own message", () => {
    const d = PYTHON_DRILLS.find((x) => x.id === "py-05-mutable-default")!;
    const r = executeInPyodide(py, { id: "wrong", code: d.starter, tests: d.tests.map((t) => ({ id: t.id, code: t.code })) });
    const second = r.tests.find((t) => t.id === "second")!;
    expect(second.passed).toBe(false);
    expect(second.error).toContain("the default list is shared");
  });

  it("every drill credits Study objectives and the text stays vendor-neutral", () => {
    for (const d of PYTHON_DRILLS) expect(LAB_LINKS[d.id]?.length ?? 0, d.id).toBeGreaterThan(0);
    const text = JSON.stringify(PYTHON_DRILLS.map((d) => ({ title: d.title, brief: d.brief, teaches: d.teaches })));
    for (const word of ["AWS", "Amazon"]) expect(text, word).not.toContain(word);
  });
});
