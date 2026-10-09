import { describe, expect, it } from "vitest";
import { MISSIONS } from "../src/content/missions";
import { PRIMERS } from "../src/content/primers";
import { DEFAULT_SETTINGS } from "../src/data/db";
import { defaultExplanationLevel, effectiveExplanationLevel, primerFor, primerTerms } from "../src/engine/learner/explanation";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("beginner primers", () => {
  it("exist for every mission and for nothing else", () => {
    const ids = new Set(MISSIONS.map((m) => m.id));
    for (const m of MISSIONS) expect(PRIMERS[m.id], m.id).toBeDefined();
    for (const id of Object.keys(PRIMERS)) expect(ids.has(id), `orphan primer ${id}`).toBe(true);
  });

  it("answer the three questions at beginner length, in plain words first", () => {
    for (const m of MISSIONS) {
      const p = PRIMERS[m.id];
      expect(words(p.plain), `${m.id} plain`).toBeGreaterThanOrEqual(45);
      expect(words(p.plain), `${m.id} plain too long`).toBeLessThanOrEqual(110);
      expect(p.plain, `${m.id} plain has code`).not.toMatch(/`/);
      expect(words(p.why), `${m.id} why`).toBeGreaterThanOrEqual(35);
      expect(words(p.whyThisWay), `${m.id} whyThisWay`).toBeGreaterThanOrEqual(35);
      expect(words(p.firstStep), `${m.id} firstStep`).toBeGreaterThanOrEqual(15);
      expect(p.firstStep, `${m.id} firstStep explains the first move`).toMatch(/^You start|^Filtering/);
      // The why must talk about real work or the interview, not just repeat the how.
      expect(p.why, `${m.id} why grounds the lesson`).toMatch(/interview|real|job|team|on-call|production|work|customer|posting|role|security|outage|engineer|operations/i);
    }
  });

  it("point at glossary terms they use", () => {
    const linux1 = MISSIONS.find((m) => m.id === "linux-01-find-your-way")!;
    expect(primerTerms(linux1).map((g) => g.term)).toContain("directory");
    expect(primerFor(linux1)?.firstStep).toMatch(/pwd/);
  });
});

describe("explanation level", () => {
  it("is beginner-first for the unnamed-role track and standard for the SDE II posting", () => {
    expect(defaultExplanationLevel("ops-automation")).toBe("beginner");
    expect(defaultExplanationLevel(undefined)).toBe("beginner");
    expect(defaultExplanationLevel("sde2-serverless")).toBe("standard");
  });
  it("lets an explicit setting override the role default, and defaults to beginner with no profile", () => {
    expect(effectiveExplanationLevel(null)).toBe("beginner");
    expect(effectiveExplanationLevel({ targetRoleId: "sde2-serverless", settings: { ...DEFAULT_SETTINGS } })).toBe("standard");
    expect(effectiveExplanationLevel({ targetRoleId: "sde2-serverless", settings: { ...DEFAULT_SETTINGS, explanationLevel: "beginner" } })).toBe("beginner");
    expect(effectiveExplanationLevel({ targetRoleId: "ops-automation", settings: { ...DEFAULT_SETTINGS, explanationLevel: "standard" } })).toBe("standard");
  });
});
