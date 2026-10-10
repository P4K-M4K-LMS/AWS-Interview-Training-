import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { needsLesson, seededShuffle, toQuestion } from "../scripts/study/generate.mts";
import { PROMPT_VERSION, bankPrompt, lessonPrompt, scenarioPrompt } from "../scripts/study/prompts.mts";
import { validateLessonsFile, words } from "../src/services/study/validate";
import type { StudyCourse, StudyLesson, StudyLessonsFile, StudyScenario } from "../src/domain/types";

const course = JSON.parse(readFileSync(path.resolve(__dirname, "..", "public", "study", "saa-c03.json"), "utf8")) as StudyCourse;
const objective = course.units[1].objectives[11]; // read replicas

const sentence = "A read replica is a copy of the database that serves reads so the primary serves writes.";
const para = (n: number) => Array.from({ length: n }, () => sentence).join(" ");

function goodLesson(): StudyLesson {
  const q = (i: number, role: "fade" | "solo") => ({ id: `${objective.id}:q${i}`, role, prompt: `Question ${i} about replicas?`, choices: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], correctIndex: i % 4, why: "Because." });
  return {
    objectiveId: objective.id,
    sourceHash: objective.sourceHash,
    promptVersion: PROMPT_VERSION,
    model: "test-model",
    generatedAt: "2026-10-09T00:00:00.000Z",
    plain: para(4),
    guessPrompt: "Why might a dispatcher see a position that is a minute old?",
    teach: para(6),
    questions: [q(1, "fade"), q(2, "solo"), q(3, "solo"), q(4, "solo")],
    explainPrompt: "Explain to a teammate what a read replica buys you and one way it can mislead.",
    modelAnswer: para(2),
    rubricPoints: ["Says reads move off the primary", "Names replication lag as the catch"],
    suggested: { modality: "do-existing", missionId: "incident-04-replica-lag", rationale: "The incident makes the learner diagnose lag." },
  };
}

function goodScenario(): StudyScenario {
  return {
    unitId: course.units[1].id,
    promptVersion: PROMPT_VERSION,
    model: "test-model",
    generatedAt: "2026-10-09T00:00:00.000Z",
    title: "Stale map after a surge",
    scenario: "Dispatchers at a fictional courier see stale positions. 1. Name the likely cause. 2. Say what you would check first. 3. Say what you would not do.",
    subParts: ["Likely cause", "First check", "What not to do"],
    modelAnswer: ["Replication lag on the read replica.", "The replica's apply lag and any blocking statement.", "Fail over to the lagging replica."],
  };
}

function file(lessons: StudyLesson[], scenarios: StudyScenario[] = []): StudyLessonsFile {
  return { courseId: course.id, generated: { scriptVersion: 1, promptVersion: PROMPT_VERSION, generatedAt: "2026-10-09T00:00:00.000Z", models: ["test-model"] }, lessons, scenarios };
}

describe("Study lessons validator", () => {
  it("accepts a well-formed lesson and scenario", () => {
    expect(validateLessonsFile(file([goodLesson()], [goodScenario()]), course)).toEqual([]);
  });

  it("rejects a stale source hash, a wrong course, bookkeeping lessons and duplicates", () => {
    const stale = { ...goodLesson(), sourceHash: "000000000000" };
    expect(validateLessonsFile(file([stale]), course).map((p) => p.message)).toEqual([expect.stringMatching(/source hash/)]);
    expect(validateLessonsFile({ ...file([goodLesson()]), courseId: "dva-c02" }, course)[0].message).toMatch(/courseId/);
    expect(validateLessonsFile(file([goodLesson(), goodLesson()]), course).map((p) => p.message)).toContain("duplicate lesson");
    const unknown = { ...goodLesson(), objectiveId: "saa-c03:9:9" };
    expect(validateLessonsFile(file([unknown]), course)[0].message).toMatch(/not in the catalog/);
  });

  it("rejects bad question banks: wrong count, three choices, repeated choices, index out of range, wrong ids and roles", () => {
    const l = goodLesson();
    expect(validateLessonsFile(file([{ ...l, questions: l.questions.slice(0, 3) }]), course).map((p) => p.message)).toContain("expected 4 questions");
    const threeChoices = { ...l, questions: l.questions.map((q, i) => (i === 1 ? { ...q, choices: q.choices.slice(0, 3) } : q)) };
    expect(validateLessonsFile(file([threeChoices]), course).map((p) => p.message)).toContain("need 4 non-empty choices");
    const repeated = { ...l, questions: l.questions.map((q, i) => (i === 2 ? { ...q, choices: ["x", "x", "y", "z"] } : q)) };
    expect(validateLessonsFile(file([repeated]), course).map((p) => p.message)).toContain("choices repeat");
    // Command flags are case-sensitive: usermod -G and usermod -g are different answers.
    const caseOnly = { ...l, questions: l.questions.map((q, i) => (i === 2 ? { ...q, choices: ["usermod -G", "usermod -g", "y", "z"] } : q)) };
    expect(validateLessonsFile(file([caseOnly]), course).map((p) => p.message)).not.toContain("choices repeat");
    const badIndex = { ...l, questions: l.questions.map((q, i) => (i === 3 ? { ...q, correctIndex: 4 } : q)) };
    expect(validateLessonsFile(file([badIndex]), course).map((p) => p.message)).toContain("correctIndex out of range");
    const badId = { ...l, questions: l.questions.map((q, i) => (i === 0 ? { ...q, id: "nope" } : q)) };
    expect(validateLessonsFile(file([badId]), course)[0].message).toMatch(/id should be/);
    const badRoles = { ...l, questions: l.questions.map((q) => ({ ...q, role: "solo" as const })) };
    expect(validateLessonsFile(file([badRoles]), course).map((p) => p.message)).toContain("questions must be one fade then three solo");
  });

  it("enforces the beginner plain paragraph, teach length, rubric size and forbidden claims", () => {
    const l = goodLesson();
    expect(validateLessonsFile(file([{ ...l, plain: "Too short." }]), course)[0].message).toMatch(/plain is 2 words/);
    expect(validateLessonsFile(file([{ ...l, plain: `${l.plain} \`code\`` }]), course).map((p) => p.message)).toContain("plain contains code formatting");
    expect(validateLessonsFile(file([{ ...l, teach: sentence }]), course)[0].message).toMatch(/teach is under/);
    expect(validateLessonsFile(file([{ ...l, rubricPoints: ["one"] }]), course)[0].message).toMatch(/rubricPoints/);
    expect(validateLessonsFile(file([{ ...l, modelAnswer: "This is certification-equivalent." }]), course)[0].message).toMatch(/forbidden claim/);
    expect(words(l.plain)).toBeGreaterThanOrEqual(45);
  });

  it("rejects scenarios whose numbered sub-tasks, labels and answers disagree", () => {
    const s = goodScenario();
    expect(validateLessonsFile(file([], [{ ...s, subParts: ["one"] }]), course).map((p) => p.message)).toContain("subParts must be 2-4 labels");
    expect(validateLessonsFile(file([], [{ ...s, modelAnswer: s.modelAnswer.slice(0, 2) }]), course).map((p) => p.message)).toContain("modelAnswer needs one entry per sub-part");
    expect(validateLessonsFile(file([], [{ ...s, scenario: "No numbering here at all." }]), course).map((p) => p.message)).toContain("scenario text does not number sub-task 1");
    expect(validateLessonsFile(file([], [{ ...s, unitId: "cmpcbs:28" }]), course)[0].message).toMatch(/not in the catalog/);
  });
});

describe("generation helpers", () => {
  it("shuffles deterministically per question id and keeps the answer key aligned", () => {
    const a = seededShuffle([0, 1, 2, 3], "saa-c03:2:12:q1");
    expect(seededShuffle([0, 1, 2, 3], "saa-c03:2:12:q1")).toEqual(a);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    const orders = new Set(["q1", "q2", "q3", "q4", "q5", "q6"].map((q) => seededShuffle([0, 1, 2, 3], `x:${q}`).join("")));
    expect(orders.size).toBeGreaterThan(1);
    const q = toQuestion("saa-c03:2:12:q2", "solo", { prompt: "p", choices: ["right", "w1", "w2", "w3"], correctIndex: 0, why: "w" });
    expect(q.choices[q.correctIndex]).toBe("right");
    expect(new Set(q.choices).size).toBe(4);
  });

  it("regenerates only missing, stale or re-prompted lessons unless forced", () => {
    const l = goodLesson();
    expect(needsLesson(undefined, objective, false)).toBe(true);
    expect(needsLesson(l, objective, false)).toBe(false);
    expect(needsLesson(l, { sourceHash: "changed" }, false)).toBe(true);
    expect(needsLesson({ ...l, promptVersion: PROMPT_VERSION - 1 }, objective, false)).toBe(true);
    expect(needsLesson(l, objective, true)).toBe(true);
  });

  it("prompts carry the course framing, the gate, neighbours, the honesty rules and the teach text", () => {
    const unit = course.units[1];
    const ctx = { course, unit, objective, missions: [{ id: "incident-04-replica-lag", title: "Replica lag" }], engines: [{ id: "dr-planner", name: "DR planner" }] };
    const a = lessonPrompt(ctx);
    expect(a.user).toContain("SAA-C03");
    expect(a.user).toContain("26% of the exam");
    expect(a.user).toContain("RTO and RPO");
    expect(a.user).toContain(objective.text);
    expect(a.user).toContain("Horizontal scaling versus vertical scaling");
    expect(a.user).toContain("incident-04-replica-lag");
    expect(a.system).toMatch(/never claim or imply/i);
    expect(a.system).toMatch(/never copy/i);
    const b = bankPrompt(ctx, "TEACH TEXT");
    expect(b.user).toContain("TEACH TEXT");
    // The fade question used to be the lesson's own worked example with one step blanked out.
    expect(b.user).toContain("does not appear in the teaching text");
    const c = scenarioPrompt(course, unit);
    expect(c.user).toContain("fictional company");
    expect(c.user).toContain("Read replicas");
  });
});
