// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JS_DRILLS } from "../src/content/study/jsDrills";
import { executeJs } from "../src/engine/js/execute";

const runDrill = (d: (typeof JS_DRILLS)[number], which: "starter" | "solution") =>
  executeJs({
    id: `${d.id}-${which}`,
    code: which === "starter" ? d.starter : d.solution,
    files: which === "starter" ? d.starterFiles : d.solutionFiles,
    entry: d.entry,
    dom: d.dom ? { html: d.dom } : undefined,
    suite: d.suite,
    store: d.store,
    env: d.env,
    tests: d.tests.map((t) => ({ id: t.id, code: t.code })),
  });

describe("JavaScript drills (the engine's own JavaScript)", () => {
  for (const d of JS_DRILLS) {
    it(`${d.id}: the reference passes every test and the starter fails at least one`, async () => {
      const sol = await runDrill(d, "solution");
      expect(sol.error, `${d.id} solution raised`).toBeNull();
      expect(sol.tests.filter((t) => !t.passed).map((t) => `${t.id}: ${t.error}`)).toEqual([]);
      const start = await runDrill(d, "starter");
      expect(start.error !== null || start.tests.some((t) => !t.passed), `${d.id} starter must not pass`).toBe(true);
      expect(d.hints.length).toBeGreaterThanOrEqual(3);
      expect(d.tests.length).toBeGreaterThanOrEqual(3);
      expect(Boolean(d.starter) !== Boolean(d.starterFiles), "a drill is either a script or modules").toBe(true);
    });
  }
});

describe("JavaScript lab links", () => {
  it("every drill credits Study objectives and its text stays vendor-neutral", async () => {
    const { LAB_LINKS } = await import("../src/content/study/missionLinks");
    for (const d of JS_DRILLS) expect(LAB_LINKS[d.id]?.length ?? 0, d.id).toBeGreaterThan(0);
    const text = JSON.stringify(JS_DRILLS.map((d) => ({ title: d.title, brief: d.brief, teaches: d.teaches })));
    for (const word of ["AWS", "Amazon"]) expect(text).not.toContain(word);
  });
});
