import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { MISSION_BY_ID } from "../src/content/missions";
import { MISSION_LINKS } from "../src/content/study/missionLinks";
import { completeMission, redoMission, startMission } from "../src/engine/missions/engine";
import { recommendNext } from "../src/engine/learner/recommend";
import { applyStudyAttempt, courseReadiness, dueStudyReviews, emptyStudyState, resolveStatus, statusCap } from "../src/engine/study/mastery";
import type { StudyAttempt, StudyCourse, StudyObjectiveState } from "../src/domain/types";

const T0 = "2026-10-09T10:00:00.000Z";
let n = 0;
function a(format: StudyAttempt["format"], verdict: StudyAttempt["verdict"], source: StudyAttempt["source"] = "auto"): StudyAttempt {
  n += 1;
  return { at: new Date(Date.parse(T0) + n * 60_000).toISOString(), format, verdict, source, questionId: `q${n}` };
}

describe("Study objective status (ported 0–4 rubric)", () => {
  it("starts at not-started and reading alone never passes it", () => {
    expect(resolveStatus([])).toBe("not-started");
  });

  it("one multiple-choice answer only introduces; two good ones reach Guided", () => {
    expect(resolveStatus([a("mc", "correct")])).toBe("introduced");
    expect(resolveStatus([a("mc", "correct"), a("mc", "correct")])).toBe("guided");
    // Over the last four multiple-choice answers, three in four is the bar.
    expect(resolveStatus([a("mc", "incorrect"), a("mc", "correct"), a("mc", "correct")])).toBe("introduced");
    expect(resolveStatus([a("mc", "incorrect"), a("mc", "correct"), a("mc", "correct"), a("mc", "correct")])).toBe("guided");
  });

  it("a mission credit reaches Guided at most, even repeated", () => {
    expect(resolveStatus([a("mission", "correct", "mission")])).toBe("guided");
    expect(resolveStatus([a("mission", "correct", "mission"), a("lab", "correct", "mission"), a("mission", "correct", "mission")])).toBe("guided");
  });

  it("a self-rated open answer reaches Independent, never Transfer-ready", () => {
    const h = [a("mc", "correct"), a("mc", "correct"), a("open", "correct", "self")];
    expect(resolveStatus(h)).toBe("independent");
    const more = [...h, a("open", "correct", "self"), a("pbq", "correct", "self"), a("open", "correct", "self")];
    expect(resolveStatus(more)).toBe("independent");
  });

  it("Transfer-ready needs proficiency and two proxy-graded open answers, the last one correct", () => {
    const h = [a("mc", "correct"), a("mc", "correct"), a("open", "correct", "proxy")];
    expect(resolveStatus(h)).toBe("independent");
    expect(resolveStatus([...h, a("pbq", "correct", "proxy")])).toBe("transfer-ready");
    // Proficiency is over all attempts: too many misses keep it at Independent.
    const shaky = [a("mc", "incorrect"), a("mc", "correct"), a("mc", "correct"), a("open", "correct", "proxy"), a("mc", "incorrect"), a("open", "correct", "proxy")];
    expect(resolveStatus(shaky)).toBe("independent");
  });

  it("a single miss keeps Independent, two in a row drop it one level; needs-review is reached from Guided or below", () => {
    const independent = [a("mc", "correct"), a("mc", "correct"), a("open", "correct", "self")];
    expect(resolveStatus([...independent, a("mc", "incorrect")])).toBe("independent");
    expect(resolveStatus([...independent, a("mc", "incorrect"), a("mc", "incorrect")])).toBe("guided");
    expect(resolveStatus([...independent, a("mc", "incorrect"), a("mc", "incorrect"), a("mc", "incorrect")])).toBe("needs-review");
    const guided = [a("mc", "correct"), a("mc", "correct")];
    expect(resolveStatus([...guided, a("mc", "incorrect")])).toBe("introduced");
    expect(resolveStatus([...guided, a("mc", "incorrect"), a("mc", "incorrect")])).toBe("needs-review");
    expect(resolveStatus([a("mc", "incorrect"), a("mc", "incorrect")])).toBe("needs-review");
  });

  it("caps do-new objectives at Independent and bookkeeping at not-started", () => {
    expect(statusCap({ modality: "do-new", kind: "objective" })).toBe("independent");
    expect(statusCap({ modality: "read", kind: "bookkeeping" })).toBe("not-started");
    expect(statusCap({ modality: "read", kind: "objective" })).toBeUndefined();
    const h = [a("mc", "correct"), a("mc", "correct"), a("open", "correct", "proxy"), a("pbq", "correct", "proxy")];
    expect(resolveStatus(h)).toBe("transfer-ready");
    expect(resolveStatus(h, "independent")).toBe("independent");
  });

  it("schedules reviews 1, 7 and 21 days out and resolves after the third pass", () => {
    let s = emptyStudyState("saa-c03:2:12");
    expect(s.courseId).toBe("saa-c03");
    expect(s.unitId).toBe("saa-c03:2");
    s = applyStudyAttempt(s, { at: T0, format: "mc", verdict: "incorrect", source: "auto", questionId: "q1" });
    expect(s.status).toBe("introduced");
    expect(s.reviewStage).toBe(0);
    expect(s.nextReviewAt).toBe("2026-10-10T10:00:00.000Z");
    expect(s.seenQuestionIds).toEqual(["q1"]);
    expect(dueStudyReviews([s], new Date("2026-10-10T09:00:00Z"))).toHaveLength(0);
    expect(dueStudyReviews([s], new Date("2026-10-10T11:00:00Z"))).toHaveLength(1);
    s = applyStudyAttempt(s, { at: "2026-10-10T11:00:00.000Z", format: "mc", verdict: "correct", source: "auto", questionId: "q2" });
    expect(s.reviewStage).toBe(1);
    expect(s.nextReviewAt).toBe("2026-10-17T11:00:00.000Z");
    s = applyStudyAttempt(s, { at: "2026-10-17T12:00:00.000Z", format: "mc", verdict: "correct", source: "auto", questionId: "q3" });
    expect(s.reviewStage).toBe(2);
    expect(s.nextReviewAt).toBe("2026-11-07T12:00:00.000Z");
    s = applyStudyAttempt(s, { at: "2026-11-07T12:00:00.000Z", format: "mc", verdict: "correct", source: "auto", questionId: "q4" });
    expect(s.reviewStage).toBe(3);
    expect(s.nextReviewAt).toBeNull();
    expect(s.status).toBe("guided");
    // A miss restarts the schedule; a mission credit leaves it alone.
    s = applyStudyAttempt(s, { at: "2026-11-08T12:00:00.000Z", format: "open", verdict: "incorrect", source: "self" });
    expect(s.reviewStage).toBe(0);
    expect(s.nextReviewAt).toBe("2026-11-09T12:00:00.000Z");
    const credited = applyStudyAttempt(s, { at: "2026-11-08T13:00:00.000Z", format: "mission", verdict: "correct", source: "mission", ref: "x" });
    expect(credited.nextReviewAt).toBe(s.nextReviewAt);
    expect(credited.reviewStage).toBe(0);
  });

  it("keeps only the last 30 attempts", () => {
    let s = emptyStudyState("python:1:1");
    for (let i = 0; i < 40; i++) s = applyStudyAttempt(s, a("mc", "correct"));
    expect(s.attempts).toHaveLength(30);
  });

  it("computes readiness weighted by exam domain weight, or plain coverage without weights", () => {
    const course: Pick<StudyCourse, "units"> = {
      units: [
        { id: "c:1", index: 1, title: "A", weight: 75, objectives: [{ id: "c:1:1" }, { id: "c:1:2" }].map((o) => ({ ...o, unitId: "c:1", index: 1, text: "", sourceHash: "x", kind: "objective" as const, modality: "read" as const, modalitySource: "default" as const })) },
        { id: "c:2", index: 2, title: "B", weight: 25, objectives: [{ id: "c:2:1" }, { id: "c:2:2" }].map((o) => ({ ...o, unitId: "c:2", index: 1, text: "", sourceHash: "x", kind: "objective" as const, modality: "read" as const, modalitySource: "default" as const })) },
        { id: "c:3", index: 3, title: "Bookkeeping", objectives: [{ id: "c:3:1", unitId: "c:3", index: 1, text: "", sourceHash: "x", kind: "bookkeeping" as const, modality: "read" as const, modalitySource: "default" as const }] },
      ],
    };
    const states = new Map<string, StudyObjectiveState>();
    const mastered = (id: string) => ({ ...emptyStudyState(id), status: "independent" as const, score: 3 });
    states.set("c:2:1", mastered("c:2:1"));
    states.set("c:2:2", mastered("c:2:2"));
    states.set("c:3:1", mastered("c:3:1"));
    const r = courseReadiness(course, states);
    expect(r).toEqual({ percent: 25, kind: "readiness", mastered: 2, total: 4 });
    states.set("c:1:1", { ...emptyStudyState("c:1:1"), status: "guided", score: 2 });
    expect(courseReadiness(course, states).percent).toBe(25);
    const unweighted = { units: course.units.map((u) => ({ ...u, weight: undefined })) };
    expect(courseReadiness(unweighted, states)).toEqual({ percent: 50, kind: "coverage", mastered: 2, total: 4 });
  });
});

describe("mission bridge into Study", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("credits the linked objectives once on first completion, to Guided, and not again on redo", async () => {
    const mission = MISSION_BY_ID.get("incident-04-replica-lag")!;
    const linked = MISSION_LINKS[mission.id];
    expect(linked).toContain("saa-c03:2:12");
    await startMission(mission.id);
    await completeMission(mission, 12);
    const state = await db.studyObjectives.get("saa-c03:2:12");
    expect(state?.status).toBe("guided");
    expect(state?.score).toBe(2);
    expect(state?.attempts).toHaveLength(1);
    expect(state?.attempts[0]).toMatchObject({ format: "mission", verdict: "correct", source: "mission", ref: mission.id });
    expect(state?.nextReviewAt).toBeNull();
    for (const id of linked) expect((await db.studyObjectives.get(id))?.status).toBe("guided");
    // Skills are untouched by Study; the bridge only writes study tables.
    await redoMission(mission.id);
    await completeMission(mission, 5);
    expect((await db.studyObjectives.get("saa-c03:2:12"))?.attempts).toHaveLength(1);
  });

  it("an unlinked mission writes nothing", async () => {
    const mission = MISSION_BY_ID.get("linux-01-find-your-way")!;
    expect(MISSION_LINKS[mission.id]).toBeUndefined();
    await startMission(mission.id);
    await completeMission(mission, 3);
    expect(await db.studyObjectives.count()).toBe(0);
  });

  it("recommendations surface a due study review and otherwise the course to continue", () => {
    const due = applyStudyAttempt(emptyStudyState("saa-c03:2:12"), { at: T0, format: "mc", verdict: "incorrect", source: "auto", questionId: "q" });
    const recs = recommendNext(new Map(), new Map(), new Date("2026-10-12T00:00:00Z"), { states: [due], next: { courseId: "saa-c03", title: "AWS Solutions Architect Associate" } });
    const review = recs.find((r) => r.kind === "study-review");
    expect(review?.path).toBe("/study/saa-c03/2/12?review=1");
    expect(recs.find((r) => r.kind === "study-next")).toBeUndefined();
    const later = recommendNext(new Map(), new Map(), new Date("2026-10-09T00:00:00Z"), { states: [due], next: { courseId: "saa-c03", title: "AWS Solutions Architect Associate" } });
    expect(later.find((r) => r.kind === "study-review")).toBeUndefined();
    expect(later.find((r) => r.kind === "study-next")?.path).toBe("/study/saa-c03");
    // Without the study input nothing changes for existing callers.
    expect(recommendNext(new Map(), new Map()).map((r) => r.kind)).not.toContain("study-review");
  });
});
