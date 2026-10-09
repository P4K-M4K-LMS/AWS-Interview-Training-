import { beforeEach, describe, expect, it } from "vitest";
import { db, exportAll, importAll, resetAll, validateBundle } from "../src/data/db";
import { SCHEMA_VERSION } from "../src/domain/types";
import { emptyStudyState } from "../src/engine/study/mastery";

const now = "2026-10-09T10:00:00.000Z";
const done = (missionId: string) => ({ missionId, schemaVersion: 1 as const, status: "completed" as const, attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });

describe("export bundles across schema versions", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("still imports a v1 bundle (no Study tables) and rejects unknown versions", async () => {
    const v1 = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: [done("linux-01-find-your-way")] };
    const bundle = validateBundle(v1);
    await importAll(bundle);
    expect((await db.missions.get("linux-01-find-your-way"))?.status).toBe("completed");
    expect(await db.studyObjectives.count()).toBe(0);
    expect(() => validateBundle({ ...v1, schemaVersion: 3 })).toThrow(/Unsupported schema version 3/);
    expect(() => validateBundle({ ...v1, schemaVersion: "1" })).toThrow(/Unsupported schema version/);
    expect(() => validateBundle({ ...v1, app: "other" })).toThrow(/not exported by OpsForge/);
  });

  it("exports Study tables at the current version and round-trips them", async () => {
    await db.studyObjectives.put({ ...emptyStudyState("saa-c03:2:12"), status: "guided", score: 2 });
    await db.studyUnits.put({ id: "saa-c03:2", courseId: "saa-c03", schemaVersion: SCHEMA_VERSION, scenarioAttempts: [] });
    const out = await exportAll();
    expect(out.schemaVersion).toBe(2);
    expect(out.studyObjectives).toHaveLength(1);
    expect(out.studyUnits).toHaveLength(1);
    await resetAll();
    await importAll(validateBundle(JSON.parse(JSON.stringify(out))), db, "replace");
    expect((await db.studyObjectives.get("saa-c03:2:12"))?.status).toBe("guided");
    expect(await db.studyUnits.count()).toBe(1);
    await resetAll();
    expect(await db.studyObjectives.count()).toBe(0);
  });
});
