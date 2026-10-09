import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_ID, ROLES, roleFor } from "../src/content/roles";
import { SKILL_BY_ID, TRACKS } from "../src/content/curriculum";
import { MISSIONS } from "../src/content/missions";
import { emptyProgress } from "../src/engine/missions/engine";
import { emptySkill } from "../src/engine/learner/mastery";
import { nextMissionForGap, roleGapMap } from "../src/engine/learner/roleGap";
import type { MissionProgress, SkillId, SkillState } from "../src/domain/types";

describe("target roles", () => {
  it("has two roles, a default, and an honest fallback for unknown ids", () => {
    expect(ROLES.map((r) => r.id)).toEqual(["ops-automation", "sde2-serverless"]);
    expect(roleFor(undefined).id).toBe(DEFAULT_ROLE_ID);
    expect(roleFor("nope" as never).id).toBe(DEFAULT_ROLE_ID);
  });

  it("references only known skills, aligns every track, and keeps untrainable qualifications unmapped", () => {
    for (const r of ROLES) {
      for (const t of TRACKS) expect(r.trackAlignment[t.id], `${r.id} alignment for ${t.id}`).toBeTruthy();
      expect(r.qualifications.length).toBeGreaterThan(0);
      expect(r.disclaimer).toMatch(/does not satisfy any degree/);
      for (const q of r.qualifications) {
        for (const s of q.skills) expect(SKILL_BY_ID.has(s), `${r.id}/${q.id} skill ${s}`).toBe(true);
        if (q.coverage === "not-addressable" || q.coverage === "planned") expect(q.skills, `${r.id}/${q.id} must not map skills`).toEqual([]);
        if (q.coverage === "trainable") {
          expect(q.skills.length).toBeGreaterThan(0);
          expect(MISSIONS.some((m) => m.skills.some((s) => q.skills.includes(s))), `${r.id}/${q.id} needs at least one mission`).toBe(true);
        }
        expect(q.note.length).toBeGreaterThan(10);
      }
    }
  });

  it("quotes the serverless posting's qualifications and marks the clearance, degree and tenure as not addressable", () => {
    const r = roleFor("sde2-serverless");
    expect(r.title).toBe("System Development Engineer II, Lambda/Serverless");
    expect(r.updated).toBe("09/19/2026");
    const byId = (id: string) => r.qualifications.find((q) => q.id === id)!;
    expect(byId("b6").text).toMatch(/Top Secret with SCI/);
    expect(byId("b6").coverage).toBe("not-addressable");
    expect(byId("b1").coverage).toBe("not-addressable");
    expect(byId("b2").coverage).toBe("not-addressable");
    expect(byId("p2").coverage).toBe("partial");
    expect(byId("p2").note).toMatch(/does not emulate AWS/);
    expect(r.descriptionExcerpt).toMatch(/excerpt ends here/);
  });
});

describe("role gap map", () => {
  const skillsWith = (entries: Array<[SkillId, number]>): Map<SkillId, SkillState> => new Map(entries.map(([id, mastery]) => [id, { ...emptySkill(id), mastery }]));

  it("starts at zero and averages only mapped qualifications", () => {
    const gap = roleGapMap(roleFor("sde2-serverless"), new Map(), new Map());
    expect(gap.trainablePct).toBe(0);
    expect(gap.counts).toEqual({ trainable: 2, partial: 4, planned: 0, "not-addressable": 3 });
    expect(gap.qualifications.filter((q) => q.pct === null)).toHaveLength(3);
    expect(gap.weakest?.pct).toBe(0);
    const first = nextMissionForGap(gap);
    expect(first).not.toBeNull();
    expect(first!.mission.prerequisites).toEqual([]);
    expect(first!.gap.pct).toBe(0);
  });

  it("tracks mastery per qualification and points at an available mission for the weakest", () => {
    const skills = skillsWith([
      ["python.basics", 80], ["python.functions", 80], ["python.errors", 80], ["python.testing", 80], ["python.data", 80], ["distributed.concurrency", 80],
      ["distributed.architecture", 40], ["distributed.scaling", 40], ["distributed.resilience", 40], ["distributed.consistency", 40], ["devops.monitoring", 40],
    ]);
    const progress = new Map<string, MissionProgress>();
    for (const id of ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline"]) progress.set(id, { ...emptyProgress(id), status: "completed" });
    const gap = roleGapMap(roleFor("sde2-serverless"), skills, progress);
    const q = (id: string) => gap.qualifications.find((g) => g.qualification.id === id)!;
    expect(q("b4").pct).toBe(80);
    expect(q("b3").pct).toBe(40);
    expect(q("b5").pct).toBe(0);
    expect(gap.weakest?.qualification.id).toBe("b5");
    const next = nextMissionForGap(gap);
    expect(next?.mission.id).toBe("netsec-01-brute-force");
    expect(next?.gap.qualification.id).toBe("b5");
    expect(q("b3").missions.some((m) => m.mission.id === "incident-01-cache-stampede" && m.status === "available")).toBe(true);
  });

  it("default role: automation and Python qualifications map to existing missions", () => {
    const gap = roleGapMap(roleFor("ops-automation"), new Map(), new Map());
    expect(gap.counts["not-addressable"]).toBe(0);
    for (const g of gap.qualifications) expect(g.missions.length, g.qualification.id).toBeGreaterThan(0);
  });
});
