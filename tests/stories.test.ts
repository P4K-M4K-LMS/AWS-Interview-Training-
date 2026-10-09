import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { saveReflectionAndStory, suggestedPrinciples } from "../src/engine/missions/engine";
import { MISSION_BY_ID } from "../src/content/missions";

describe("mission reflections become draft stories", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("creates one draft per mission, marked as practice, and updates it on re-save", async () => {
    const m = MISSION_BY_ID.get("linux-02-log-detective")!;
    const first = await saveReflectionAndStory(m, m.reflectionPrompts[0], "I filtered the log with grep, grouped the errors with sort and uniq, and found the database timeout was most common.");
    expect(first.missionId).toBe(m.id);
    expect(first.source).toBe("technical-learning");
    expect(first.title).toMatch(/^Practice: /);
    expect(first.evidence).toMatch(/not workplace experience/);
    expect(first.technicalSkills).toContain("Reading and searching files");
    expect(first.principles).toEqual(["learn-and-be-curious", "dive-deep"]);
    expect(first.action).toMatch(/grep/);
    expect((await db.missions.get(m.id))?.reflections).toHaveLength(1);

    await db.stories.update(first.id, { title: "My log story", result: "Found the cause in 10 minutes" });
    const second = await saveReflectionAndStory(m, m.reflectionPrompts[0], "Revised: I verified the fix by re-running the count.");
    expect(second.id).toBe(first.id);
    expect(second.title).toBe("My log story");
    expect(second.result).toBe("Found the cause in 10 minutes");
    expect(second.action).toMatch(/Revised/);
    expect(await db.stories.count()).toBe(1);
    expect((await db.missions.get(m.id))?.reflections).toHaveLength(1);
  });

  it("suggests principles by mission kind and track", () => {
    expect(suggestedPrinciples(MISSION_BY_ID.get("incident-01-cache-stampede")!)).toEqual(["ownership", "dive-deep"]);
    expect(suggestedPrinciples(MISSION_BY_ID.get("design-01-position-ingest")!)).toEqual(["think-big", "are-right-a-lot"]);
    expect(suggestedPrinciples(MISSION_BY_ID.get("devops-01-broken-pipeline")!)).toEqual(["ownership", "insist-on-the-highest-standards"]);
    expect(suggestedPrinciples(MISSION_BY_ID.get("go-02-worker-pool")!)).toEqual(["dive-deep", "are-right-a-lot"]);
  });
});
