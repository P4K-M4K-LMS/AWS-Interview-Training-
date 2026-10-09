import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { completeMission, completeRetentionCheck, startMission, startRetentionCheck } from "../src/engine/missions/engine";
import { MISSION_BY_ID } from "../src/content/missions";
import { dueForReview } from "../src/engine/learner/mastery";
import { recommendNext } from "../src/engine/learner/recommend";

const mission = MISSION_BY_ID.get("linux-01-find-your-way")!;

describe("retention checks (spaced repetition)", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("refuses to start on a mission that is not completed", async () => {
    await startMission(mission.id);
    await expect(startRetentionCheck(mission.id)).rejects.toThrow(/completed/);
  });

  it("passing raises mastery, doubles the interval and records history", async () => {
    await startMission(mission.id);
    await completeMission(mission, 10);
    const before = (await db.skills.get("linux.navigation"))!;
    await db.missions.update(mission.id, { savedState: { shell: "old" } });

    const started = await startRetentionCheck(mission.id);
    expect(started.retention).toBeTruthy();
    expect(started.savedState).toBeUndefined();

    await completeRetentionCheck(mission, true, 5);
    const after = (await db.skills.get("linux.navigation"))!;
    expect(after.mastery).toBe(before.mastery + 8);
    expect(after.reviewIntervalDays).toBe(Math.min(60, before.reviewIntervalDays * 2));
    expect(new Date(after.nextReviewAt!).getTime()).toBeGreaterThan(new Date(before.nextReviewAt!).getTime());
    expect(after.evidence.at(-1)?.kind).toBe("retention-check");

    const p = (await db.missions.get(mission.id))!;
    expect(p.status).toBe("completed");
    expect(p.retention).toBeUndefined();
    expect(p.retentionHistory).toEqual([expect.objectContaining({ passed: true, minutes: 5 })]);
    const activity = await db.activity.where("type").equals("retention-check").toArray();
    expect(activity).toHaveLength(1);
  });

  it("giving up lowers mastery and schedules a review tomorrow", async () => {
    await startMission(mission.id);
    await completeMission(mission, 10);
    const before = (await db.skills.get("linux.files"))!;
    await startRetentionCheck(mission.id);
    await completeRetentionCheck(mission, false, 3);
    const after = (await db.skills.get("linux.files"))!;
    expect(after.mastery).toBe(Math.max(0, before.mastery - 12));
    expect(after.reviewIntervalDays).toBe(1);
    const days = (new Date(after.nextReviewAt!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(0.9);
    expect(days).toBeLessThan(1.1);
  });

  it("a due skill is recommended as a retention check on the completed mission", async () => {
    await startMission(mission.id);
    await completeMission(mission, 10);
    const s = (await db.skills.get("linux.navigation"))!;
    await db.skills.put({ ...s, nextReviewAt: new Date(Date.now() - 1000).toISOString() });
    const skills = new Map((await db.skills.toArray()).map((x) => [x.skillId, x]));
    expect(dueForReview(skills.values()).map((x) => x.skillId)).toContain("linux.navigation");
    const progress = new Map((await db.missions.toArray()).map((x) => [x.missionId, x]));
    const rec = recommendNext(progress, skills).find((r) => r.kind === "retention");
    expect(rec?.path).toBe(`/missions/${mission.id}?retention=1`);
  });
});
