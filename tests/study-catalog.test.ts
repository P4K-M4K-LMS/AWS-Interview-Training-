import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalog, missionLinksModule, stableJson } from "../scripts/study/catalog.mts";
import { MISSION_BY_ID } from "../src/content/missions";
import { ENGINE_BY_ID } from "../src/content/study/engines";
import { BOOKKEEPING_UNITS, STUDY_LAB_LINKS, STUDY_LINKS, UNIT_ENGINE_GATES } from "../src/content/study/links";
import { POLICY_EXERCISE_BY_ID } from "../src/content/study/policyExercises";
import { NETWORK_EXERCISE_BY_ID } from "../src/content/study/networkExercises";
import { DR_EXERCISE_BY_ID } from "../src/content/study/drExercises";
import { ALARM_EXERCISE_BY_ID } from "../src/content/study/alarmExercises";
import { COST_EXERCISE_BY_ID } from "../src/content/study/costExercises";
import { DEPLOY_EXERCISE_BY_ID } from "../src/content/study/deployExercises";
import { CRYPTO_EXERCISE_BY_ID } from "../src/content/study/cryptoExercises";
import { MESSAGING_EXERCISE_BY_ID } from "../src/content/study/messagingExercises";
import { AUTOSCALE_EXERCISE_BY_ID } from "../src/content/study/autoscaleExercises";
import { SQL_EXERCISE_BY_ID } from "../src/content/study/sqlExercises";
import { PYTHON_DRILL_BY_ID } from "../src/content/study/pythonDrills";
import { LAB_LABELS } from "../src/content/study/labs";
import { ENGINE_GATES, LAB_LINKS, MISSION_LINKS } from "../src/content/study/missionLinks";
import type { StudyCatalogIndex, StudyCourse } from "../src/domain/types";

const OUT = path.resolve(__dirname, "..", "public", "study");
const built = buildCatalog();

describe("Study catalog (Ascendra snapshot)", () => {
  it("covers the proof slice: 20 courses, 1,481 objectives plus 20 bookkeeping lines", () => {
    expect(built.courses).toHaveLength(20);
    expect(built.index.courses.filter((c) => c.group === "aws")).toHaveLength(11);
    expect(built.index.courses.filter((c) => c.group === "core")).toHaveLength(9);
    const objectives = built.courses.flatMap((c) => c.units.flatMap((u) => u.objectives));
    expect(objectives.filter((o) => o.kind === "objective")).toHaveLength(1481);
    expect(objectives.filter((o) => o.kind === "bookkeeping")).toHaveLength(20);
    expect(objectives).toHaveLength(1501);
  });

  it("matches the committed JSON byte for byte (run `npx tsx scripts/generate-study.mts build-catalog` after editing links or the snapshot)", () => {
    const committedIndex = readFileSync(path.join(OUT, "index.json"), "utf8");
    expect(committedIndex).toBe(stableJson(built.index));
    for (const c of built.courses) {
      expect(readFileSync(path.join(OUT, `${c.id}.json`), "utf8"), c.id).toBe(stableJson(c));
    }
    const courseFiles = readdirSync(OUT).filter((f) => f.endsWith(".json") && f !== "index.json" && !f.endsWith(".lessons.json"));
    expect(courseFiles.sort()).toEqual(built.courses.map((c) => `${c.id}.json`).sort());
    const committedModule = readFileSync(path.resolve(__dirname, "..", "src", "content", "study", "missionLinks.ts"), "utf8");
    expect(committedModule).toBe(missionLinksModule(built));
  });

  it("gives every objective a stable id, a source hash and a modality", () => {
    const seen = new Set<string>();
    for (const c of built.courses) {
      for (const u of c.units) {
        expect(u.id).toBe(`${c.id}:${u.index}`);
        for (const o of u.objectives) {
          expect(o.id).toBe(`${u.id}:${o.index}`);
          expect(seen.has(o.id), `duplicate ${o.id}`).toBe(false);
          seen.add(o.id);
          expect(o.sourceHash).toMatch(/^[0-9a-f]{12}$/);
          expect(["do-existing", "do-new", "read", "combo", "explain"]).toContain(o.modality);
          if (o.link?.kind === "mission" || o.link?.kind === "lab") {
            expect(o.modality).toBe("do-existing");
            expect(o.modalitySource).toBe("curated");
          }
        }
      }
    }
  });

  it("links only to missions that exist, with every curated entry consumed", () => {
    for (const l of STUDY_LINKS) expect(MISSION_BY_ID.has(l.mission), `link to ${l.mission}`).toBe(true);
    const linked = built.courses.flatMap((c) => c.units.flatMap((u) => u.objectives.filter((o) => o.link?.kind === "mission")));
    expect(linked).toHaveLength(STUDY_LINKS.length);
    expect(Object.values(MISSION_LINKS).flat()).toHaveLength(STUDY_LINKS.length);
    for (const m of Object.keys(MISSION_LINKS)) expect(MISSION_BY_ID.has(m)).toBe(true);
    // Linked objectives are never bookkeeping.
    for (const o of linked) expect(o.kind).toBe("objective");
  });

  it("lab links point at real labs and exercises, and every curated entry is consumed", () => {
    for (const l of STUDY_LAB_LINKS) {
      expect(LAB_LABELS[l.lab], `lab ${l.lab}`).toBeTruthy();
      if (l.lab === "policy") expect(POLICY_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "network") expect(NETWORK_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "dr") expect(DR_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "alarms") expect(ALARM_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "cost") expect(COST_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "deploy") expect(DEPLOY_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "crypto") expect(CRYPTO_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "messaging") expect(MESSAGING_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "autoscale") expect(AUTOSCALE_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "sql") expect(SQL_EXERCISE_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
      if (l.lab === "python-drills") expect(PYTHON_DRILL_BY_ID.has(l.exerciseId ?? ""), `exercise ${l.exerciseId}`).toBe(true);
    }
    const labLinked = built.courses.flatMap((c) => c.units.flatMap((u) => u.objectives.filter((o) => o.link?.kind === "lab")));
    expect(labLinked).toHaveLength(STUDY_LAB_LINKS.length);
    expect(Object.values(LAB_LINKS).flat()).toHaveLength(STUDY_LAB_LINKS.filter((l) => l.exerciseId).length);
    const total = built.courses.reduce((a, c) => a + c.counts.linked, 0);
    expect(total).toBe(STUDY_LINKS.length + STUDY_LAB_LINKS.length);
  });

  it("maps unit gates to planned engines that are declared, and bookkeeping units to the degree plan", () => {
    for (const g of UNIT_ENGINE_GATES) expect(ENGINE_BY_ID.has(g.engine), g.engine).toBe(true);
    expect(Object.keys(ENGINE_GATES).sort()).toEqual(["dr-planner", "net-trace", "policy-eval"]);
    for (const ids of Object.values(ENGINE_GATES)) expect(ids.length).toBeGreaterThan(0);
    for (const b of BOOKKEEPING_UNITS) expect(b.course).toBe("CMPCBS");
    const cmpcbs = built.courses.find((c) => c.id === "cmpcbs") as StudyCourse;
    expect(cmpcbs.counts.bookkeeping).toBe(20);
    for (const u of cmpcbs.units) {
      const kinds = new Set(u.objectives.map((o) => o.kind));
      expect(kinds.size, `unit ${u.title} mixes kinds`).toBe(1);
    }
  });

  it("records provenance and exam churn honestly", () => {
    const index: StudyCatalogIndex = built.index;
    expect(index.builtFrom.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    for (const c of built.courses) {
      expect(c.provenance.sourceRepo).toBe("ascendra");
      expect(c.provenance.note).toMatch(/unofficial/);
      expect(c.title).not.toMatch(/Coach$/);
      if (c.trackType === "certification" && c.code.startsWith("AWS")) {
        expect(c.provenance.examCode).toBeTruthy();
        expect(c.provenance.officialObjectivesUrl).toMatch(/^https:/);
        expect(c.provenance.sourceVerifiedAt).toBeTruthy();
      }
    }
    const dva = index.courses.find((c) => c.id === "dva-c02");
    expect(dva?.credentialStatus).toBe("transitioning");
    expect(dva?.retirementDate).toBe("2026-12-01");
  });

  it("keeps the index small and the counts consistent", () => {
    expect(stableJson(built.index).length).toBeLessThan(20_000);
    for (const s of built.index.courses) {
      const c = built.courses.find((x) => x.id === s.id) as StudyCourse;
      expect(s.counts).toEqual(c.counts);
      expect(Object.values(s.modalities).reduce((a, b) => a + b, 0)).toBe(c.counts.objectives);
      expect(s.hash).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});
