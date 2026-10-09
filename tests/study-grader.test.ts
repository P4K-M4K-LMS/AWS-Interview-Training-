import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/data/db";
import { buildGradeBody, gradeAnswer, proxyAvailable } from "../src/services/study/grader";
import type { LearnerSettings } from "../src/domain/types";

const on: LearnerSettings = { ...DEFAULT_SETTINGS, coachMode: "claude", coachConsent: true, coachProxyUrl: "http://localhost:8787/" };
const req = { kind: "explain" as const, prompt: "Explain read replicas.", answer: "Reads go to a copy that can lag.", modelAnswer: "A copy serves reads; it can lag.", rubricPoints: ["reads move", "lag"] };

describe("Study grading via the proxy", () => {
  it("falls back to self-rating, with the reason, whenever the proxy is off, unconsented or unconfigured", async () => {
    expect(proxyAvailable(DEFAULT_SETTINGS)).toEqual({ ok: false, reason: expect.stringMatching(/off/) });
    expect(proxyAvailable({ ...on, coachConsent: false })).toEqual({ ok: false, reason: expect.stringMatching(/Consent/) });
    expect(proxyAvailable({ ...on, coachProxyUrl: "" })).toEqual({ ok: false, reason: expect.stringMatching(/URL/) });
    expect(proxyAvailable(on)).toEqual({ ok: true });
    const r = await gradeAnswer(req, DEFAULT_SETTINGS, () => {
      throw new Error("must not be called");
    });
    expect(r.source).toBe("self");
  });

  it("sends the question, answer and key to /api/study/grade and returns a proxy verdict", async () => {
    let seen: { url: string; body: unknown } | undefined;
    const r = await gradeAnswer(req, on, (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ verdict: "partial", feedback: "You named lag but not that reads move.", missedPoints: ["reads move"], model: "m" }), { status: 200 });
    }) as typeof fetch);
    expect(seen?.url).toBe("http://localhost:8787/api/study/grade");
    expect(seen?.body).toEqual(buildGradeBody(req));
    expect(seen?.body).toMatchObject({ kind: "explain", rubricPoints: ["reads move", "lag"], modelAnswer: "A copy serves reads; it can lag." });
    expect(r).toEqual({ source: "proxy", verdict: "partial", feedback: "You named lag but not that reads move.", missedPoints: ["reads move"], model: "m" });
  });

  it("scenario requests carry the sub-parts and a per-part key", () => {
    const body = buildGradeBody({ kind: "scenario", prompt: "S 1. a 2. b", answer: "x", modelAnswer: ["A", "B"], subParts: ["a", "b"] });
    expect(body).toEqual({ kind: "scenario", prompt: "S 1. a 2. b", answer: "x", modelAnswer: ["A", "B"], subParts: ["a", "b"] });
  });

  it("treats proxy errors, bad verdicts and network failures as self-rating with a reason", async () => {
    const bad = await gradeAnswer(req, on, (async () => new Response("boom", { status: 502 })) as typeof fetch);
    expect(bad).toEqual({ source: "self", reason: expect.stringMatching(/502/) });
    const noVerdict = await gradeAnswer(req, on, (async () => new Response(JSON.stringify({ feedback: "?" }), { status: 200 })) as typeof fetch);
    expect(noVerdict).toEqual({ source: "self", reason: expect.stringMatching(/usable verdict/) });
    const down = await gradeAnswer(req, on, (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch);
    expect(down).toEqual({ source: "self", reason: expect.stringMatching(/ECONNREFUSED/) });
  });
});
