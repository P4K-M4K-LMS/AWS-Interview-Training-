import { describe, expect, it } from "vitest";
import { agileMissions } from "../src/content/missions/agile";
import { GENERAL_QUESTIONS } from "../src/content/leadershipPrinciples";

describe("lesson missions", () => {
  it("have a scenario, at least five quiz questions with a valid answer each, and an interview cue", () => {
    for (const m of agileMissions) {
      expect(m.scenario.length).toBeGreaterThan(80);
      expect(m.quiz.length).toBeGreaterThanOrEqual(5);
      expect(new Set(m.quiz.map((q) => q.id)).size).toBe(m.quiz.length);
      for (const q of m.quiz) {
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(q.explanation.length).toBeGreaterThan(20);
      }
      expect(m.interviewCue).toMatch(/STAR/);
      expect(m.lesson.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("adds the Agile interview question to the general pool", () => {
    const q = GENERAL_QUESTIONS.find((x) => x.id === "general-agile");
    expect(q?.text).toMatch(/Agile or Scrum/);
    expect(q?.listeningFor.length).toBe(4);
  });
});
