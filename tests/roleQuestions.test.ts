import { describe, expect, it } from "vitest";
import { ALL_ROLE_QUESTIONS, ROLE_QUESTIONS, roleQuestionById, roleQuestionsFor } from "../src/content/roleQuestions";
import { GENERAL_QUESTIONS, LEADERSHIP_PRINCIPLES } from "../src/content/leadershipPrinciples";
import { ROLES } from "../src/content/roles";
import { MISSION_BY_ID } from "../src/content/missions";

describe("role-specific interview questions", () => {
  it("gives every role at least eight technical questions with unique ids", () => {
    for (const r of ROLES) {
      expect(ROLE_QUESTIONS[r.id].length, r.id).toBeGreaterThanOrEqual(8);
      for (const q of ROLE_QUESTIONS[r.id]) {
        expect(q.roleId).toBe(r.id);
        expect(q.kind).toBe("technical");
        expect(q.principleId).toBeNull();
      }
    }
    const ids = ALL_ROLE_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const other = new Set([...GENERAL_QUESTIONS, ...LEADERSHIP_PRINCIPLES.flatMap((p) => p.questions)].map((q) => q.id));
    for (const id of ids) expect(other.has(id), `${id} collides with a behavioral question`).toBe(false);
  });

  it("ties each question to a real qualification of its role and to missions that exist", () => {
    for (const r of ROLES) {
      const qualIds = new Set(r.qualifications.map((q) => q.id));
      for (const q of ROLE_QUESTIONS[r.id]) {
        expect(qualIds.has(q.qualificationId), `${q.id} qualification ${q.qualificationId}`).toBe(true);
        expect(q.missionIds.length).toBeGreaterThan(0);
        for (const m of q.missionIds) expect(MISSION_BY_ID.has(m), `${q.id} mission ${m}`).toBe(true);
        expect(q.listeningFor.length).toBe(4);
        expect(q.text, `${q.id} should ask something`).toMatch(/\?/);
        // Concepts, not vendors: the simulator does not emulate any provider's products.
        expect(q.text).not.toMatch(/\b(Lambda|SQS|DynamoDB|S3|EC2|Kinesis|CloudWatch)\b/);
      }
      // Every trainable or partly covered qualification with missions has at least one question.
      for (const qual of r.qualifications.filter((x) => x.skills.length > 0 && x.id !== "b1")) {
        expect(ROLE_QUESTIONS[r.id].some((q) => q.qualificationId === qual.id), `${r.id}/${qual.id} has no question`).toBe(true);
      }
    }
  });

  it("falls back to the unnamed-role set and resolves ids", () => {
    expect(roleQuestionsFor(undefined)).toBe(ROLE_QUESTIONS["ops-automation"]);
    expect(roleQuestionsFor("sde2-serverless")[0].id).toBe("ss-ingest-design");
    expect(roleQuestionById("oa-red-pipeline")?.missionIds).toContain("devops-01-broken-pipeline");
    expect(roleQuestionById("general-1")).toBeUndefined();
    expect(roleQuestionById(null)).toBeUndefined();
  });
});
