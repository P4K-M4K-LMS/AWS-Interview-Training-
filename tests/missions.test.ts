// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { Shell } from "../src/engine/terminal/shell";
import { computeStatus, emptyProgress, runTerminalChecks } from "../src/engine/missions/engine";
import { MISSIONS, MISSION_BY_ID, RECOMMENDED_ORDER } from "../src/content/missions";
import { simulatePipelineRun } from "../src/content/missions/devops";
import { executeInPyodide, type PyodideLike } from "../src/engine/python/execute";
import { SKILL_BY_ID } from "../src/content/curriculum";
import type { InvestigationMission, MissionProgress, PythonMission, TerminalMission } from "../src/domain/types";

/**
 * Verifies every MVP mission can actually be completed: each terminal /
 * investigation mission is solved by running its level-4 guided example,
 * and each Python mission's reference solution passes all tests.
 */

function guidedCommands(m: TerminalMission | InvestigationMission): string[] {
  const guided = m.hints.find((h) => h.level === 4)!;
  const block = guided.body.match(/```\n([\s\S]*?)```/);
  expect(block, `${m.id} needs a guided example code block`).toBeTruthy();
  return block![1].split("\n").map((l) => l.trim()).filter(Boolean);
}

describe("mission catalogue integrity", () => {
  it("has the MVP counts", () => {
    const by = (k: string) => MISSIONS.filter((m) => m.kind === k).length;
    expect(MISSIONS.filter((m) => m.trackId === "linux").length).toBe(5);
    expect(by("python")).toBe(5);
    expect(by("bigo")).toBe(3);
    expect(MISSIONS.filter((m) => m.trackId === "netsec").length).toBe(2);
    expect(MISSIONS.filter((m) => m.trackId === "devops").length).toBe(5);
    expect(by("incident")).toBe(7);
    expect(by("go")).toBe(5);
  });
  it("every mission in the recommended order becomes available in sequence", () => {
    const progress = new Map<string, MissionProgress>();
    for (const id of RECOMMENDED_ORDER) {
      const m = MISSION_BY_ID.get(id)!;
      expect(computeStatus(m, progress, new Map()), `${id} should be available`).toBe("available");
      progress.set(id, { ...emptyProgress(id), status: "completed" });
    }
  });
  it("references only known skills and missions", () => {
    for (const m of MISSIONS) {
      for (const s of m.skills) expect(SKILL_BY_ID.has(s), `${m.id} skill ${s}`).toBe(true);
      for (const p of m.prerequisites) expect(MISSION_BY_ID.has(p), `${m.id} prereq ${p}`).toBe(true);
      expect(m.hints.length).toBe(4);
      expect(m.lesson.length).toBeGreaterThan(0);
      expect(m.reflectionPrompts.length).toBeGreaterThan(0);
    }
    expect(new Set(RECOMMENDED_ORDER).size).toBe(MISSIONS.length);
  });
});

describe("terminal and investigation missions are completable", () => {
  for (const m of MISSIONS.filter((x): x is TerminalMission | InvestigationMission => x.kind === "terminal" || x.kind === "investigation")) {
    it(m.id, () => {
      const sh = new Shell(m.world);
      const before = runTerminalChecks(m, sh.checkContext());
      // Invariant checks (e.g. "test not deleted", "no secret committed") may pass from the start; the mission must not.
      expect(before.some((c) => !c.passed), `${m.id} must not start already solved`).toBe(true);
      expect(before.filter((c) => !c.passed).length, `${m.id} should have real work to do`).toBeGreaterThanOrEqual(2);
      for (const cmd of guidedCommands(m)) {
        const r = sh.execute(cmd);
        if (m.id === "devops-01-broken-pipeline") {
          simulatePipelineRun((p) => sh.readFile(p), (p, c) => sh.writeFile(p, c, true), (p) => sh.checkContext().mode(p));
        }
        // Non-zero exits are realistic (e.g. systemctl status on a failed unit); only reject unsupported commands and syntax errors.
        expect(r.exitCode, `${m.id}: '${cmd}' unsupported: ${r.stderr}`).not.toBe(127);
        expect(r.stderr, `${m.id}: '${cmd}' syntax error`).not.toMatch(/syntax error/);
      }
      const after = runTerminalChecks(m, sh.checkContext());
      for (const c of after) expect(c.passed, `${m.id} check '${c.label}' ${c.detail ?? ""}`).toBe(true);
    });
  }
});

describe("python missions are completable", () => {
  let py: PyodideLike;
  beforeAll(async () => {
    py = (await loadPyodide()) as unknown as PyodideLike;
  }, 120_000);

  for (const m of MISSIONS.filter((x): x is PythonMission => x.kind === "python")) {
    it(`${m.id}: starter code does not pass, reference solution passes`, () => {
      const starter = executeInPyodide(py, { id: "s", code: m.starterCode, tests: m.tests.map((t) => ({ id: t.id, code: t.code, stdin: t.stdin })) });
      expect(starter.tests.some((t) => !t.passed), `${m.id} starter must not already pass`).toBe(true);
      const ref = executeInPyodide(py, { id: "r", code: m.referenceSolution, tests: m.tests.map((t) => ({ id: t.id, code: t.code, stdin: t.stdin })) });
      expect(ref.error, `${m.id} reference raised: ${ref.error}`).toBeNull();
      for (const t of ref.tests) expect(t.passed, `${m.id} test ${t.id}: ${t.error}`).toBe(true);
    });
  }
});
