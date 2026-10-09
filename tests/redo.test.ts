import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { completeMission, computeStatus, redoMission, startMission } from "../src/engine/missions/engine";
import { MISSION_BY_ID } from "../src/content/missions";
import type { MissionProgress } from "../src/domain/types";

const linux1 = MISSION_BY_ID.get("linux-01-find-your-way")!;
const linux2 = MISSION_BY_ID.get("linux-02-log-detective")!;

describe("redo after completion", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("reopens a completed mission as practice, keeps the record, and awards no second mastery", async () => {
    await startMission(linux1.id);
    await db.missions.put({ ...(await db.missions.get(linux1.id))!, savedState: { cwd: "/home/trainee/ops" }, attempts: 3, hintsUsed: 2, maxHintLevel: 2 });
    const first = await completeMission(linux1, 7);
    expect(first.status).toBe("completed");
    const masteryAfterFirst = Object.fromEntries((await db.skills.toArray()).map((s) => [s.skillId, s.mastery]));
    expect(Object.values(masteryAfterFirst).some((m) => m > 0)).toBe(true);

    const redo = await redoMission(linux1.id);
    expect(redo.status).toBe("in-progress");
    expect(redo.redoCount).toBe(1);
    expect(redo.completedAt).toBe(first.completedAt);
    expect(redo.savedState).toBeUndefined();
    expect(redo.attempts).toBe(0);
    expect(redo.hintsUsed).toBe(0);
    expect(redo.maxHintLevel).toBe(0);

    // Dependants stay unlocked while the prerequisite is being redone.
    const progress = new Map<string, MissionProgress>([[linux1.id, redo]]);
    expect(computeStatus(linux2, progress, new Map())).toBe("available");
    expect(computeStatus(linux1, progress, new Map())).toBe("in-progress");

    const again = await completeMission(linux1, 4);
    expect(again.status).toBe("completed");
    expect(again.completedAt).toBe(first.completedAt);
    const masteryAfterRedo = Object.fromEntries((await db.skills.toArray()).map((s) => [s.skillId, s.mastery]));
    expect(masteryAfterRedo).toEqual(masteryAfterFirst);
    const activity = await db.activity.toArray();
    expect(activity.filter((a) => a.type === "mission-complete" && a.missionId === linux1.id)).toHaveLength(2);
    expect(activity.some((a) => a.detail === "redo, no mastery change")).toBe(true);
  });

  it("refuses to redo a mission that was never completed", async () => {
    await startMission(linux1.id);
    await expect(redoMission(linux1.id)).rejects.toThrow(/completed/);
  });
});
