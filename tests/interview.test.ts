import { describe, expect, it } from "vitest";
import { analyzeAnswer } from "../src/engine/interview/star";
import { applyFollowUpAnswer, createDiveDeeperState, nextFollowUp, stopDiveDeeper } from "../src/engine/interview/diveDeeper";
import { buildRuleBasedFeedback, compareFeedback } from "../src/engine/interview/scoring";
import { LEADERSHIP_PRINCIPLES } from "../src/content/leadershipPrinciples";

const WEAK = "Our system stopped working, and we fixed it. Everything worked out and the team was happy.";
const STRONG =
  "Last spring, while I was the on-call trainee for our fleet API, customers reported that vehicle positions froze for minutes at a time. My responsibility was to find the cause before the morning peak. " +
  "I checked the API logs first because the symptoms were intermittent, and I used grep and sort to group the errors; 18 of 23 errors were database timeouts to the primary. I then compared the timeout spikes with the cache metrics and found the cache expiring hundreds of keys at once, which pushed load to the database. " +
  "I considered restarting the database, but rejected it because the evidence pointed at the cache, so instead I staggered the cache expiry by adding a random jitter. " +
  "As a result, database timeouts dropped from 23 per hour to zero over the next two days, which I verified on the dashboard. I learned to confirm the root cause with two independent signals before changing anything.";

describe("STAR analyzer", () => {
  it("flags vague answers with ownership, detail and results gaps", () => {
    const a = analyzeAnswer(WEAK, null);
    expect(a.vagueStatements.length).toBeGreaterThan(0);
    const types = a.gaps.map((g) => g.type);
    expect(types).toContain("ownership");
    expect(types).toContain("technical-detail");
    expect(types).toContain("results");
    expect(a.ownership.iCount).toBe(0);
  });

  it("recognises a complete STAR answer", () => {
    const a = analyzeAnswer(STRONG, "dive-deep");
    expect(a.evidence.situation.length).toBeGreaterThan(0);
    expect(a.evidence.task.length).toBeGreaterThan(0);
    expect(a.evidence.action.length).toBeGreaterThanOrEqual(3);
    expect(a.evidence.result.length).toBeGreaterThan(0);
    expect(a.evidence.learning.length).toBeGreaterThan(0);
    expect(a.numbers.length).toBeGreaterThan(0);
    expect(a.gaps.filter((g) => g.severity >= 2).map((g) => g.type)).not.toContain("results");
    expect(a.principleCues.length).toBeGreaterThan(0);
  });
});

describe("Dive Deeper", () => {
  it("asks targeted follow-ups, keeps state, and resolves gaps with new evidence", () => {
    let state = createDiveDeeperState("Tell me about a time you solved a difficult technical problem.", null, WEAK);
    expect(state.gaps.length).toBeGreaterThan(2);
    const first = nextFollowUp(state, "t1");
    state = first.state;
    expect(first.followUp).not.toBeNull();
    expect(["technical-detail", "ownership", "results"]).toContain(first.followUp!.gap);
    expect(first.followUp!.level).toBe(1);

    const r1 = applyFollowUpAnswer(state, "I was responsible for checking the server. I checked the logs first and saw repeated database timeout errors, so I traced them to a cache expiry problem.");
    state = r1.state;
    expect(r1.addedEvidence).toBe(true);
    expect(state.newDetails.length).toBeGreaterThan(0);
    expect(state.originalQuestion).toContain("difficult technical problem");
    expect(state.followUps[0].answered).toBe(true);

    const second = nextFollowUp(state, "t2");
    expect(second.followUp).not.toBeNull();
    expect(second.followUp!.gap).not.toBe(first.followUp!.gap === "technical-detail" && r1.state.gaps.find((g) => g.type === "technical-detail")?.resolved ? "technical-detail" : "__none__");
    expect(second.followUp!.text).not.toBe(first.followUp!.text);
  });

  it("accepts 'I don't know' without pressure and never repeats a resolved gap", () => {
    let state = createDiveDeeperState("Tell me about a time you improved a process.", "ownership", "We improved the deployment process and it was successful.");
    const f = nextFollowUp(state, "t1");
    state = f.state;
    const gap = f.followUp!.gap;
    state = applyFollowUpAnswer(state, "I don't remember the details.").state;
    expect(state.gaps.find((g) => g.type === gap)?.resolved).toBe(true);
    const asked = new Set<string>();
    for (let i = 0; i < 10 && !state.finished; i++) {
      const n = nextFollowUp(state, `t${i + 2}`);
      state = n.state;
      if (!n.followUp) break;
      expect(asked.has(`${n.followUp.gap}-${n.followUp.level}`)).toBe(false);
      asked.add(`${n.followUp.gap}-${n.followUp.level}`);
      state = applyFollowUpAnswer(state, "I don't know.").state;
    }
    expect(state.finished).toBe(true);
  });

  it("stops when the learner asks and when evidence is sufficient", () => {
    const s = createDiveDeeperState("Q", null, STRONG);
    expect(s.gaps.filter((g) => g.severity >= 2).length).toBeLessThanOrEqual(1);
    const stopped = stopDiveDeeper(s, "learner-stopped");
    expect(stopped.finished).toBe(true);
    expect(stopped.finishReason).toBe("learner-stopped");
  });
});

describe("Scoring", () => {
  it("scores strong answers above weak ones with explanatory evidence", () => {
    const weak = buildRuleBasedFeedback({ questionText: "Tell me about a time you solved a difficult technical problem.", principleId: "dive-deep", answer: WEAK });
    const strong = buildRuleBasedFeedback({ questionText: "Tell me about a time you solved a difficult technical problem.", principleId: "dive-deep", answer: STRONG });
    expect(strong.overall).toBeGreaterThan(weak.overall + 25);
    expect(weak.categories.reduce((s, c) => s + c.weight, 0)).toBe(100);
    for (const c of strong.categories) expect(c.evidence.length).toBeGreaterThan(0);
    expect(weak.recommendations.length).toBeGreaterThan(2);
    expect(weak.limitations).toContain("cannot verify");
    expect(weak.source).toBe("rules");
    expect(weak.delivery).toBeUndefined();
  });

  it("only declares improvement when evidence gets stronger", () => {
    const q = "Tell me about a time you solved a difficult technical problem.";
    const before = buildRuleBasedFeedback({ questionText: q, principleId: null, answer: WEAK });
    const after = buildRuleBasedFeedback({ questionText: q, principleId: null, answer: STRONG });
    expect(compareFeedback(before, after).improved).toBe(true);
    expect(compareFeedback(after, before).improved).toBe(false);
  });
});

describe("Leadership Principles content", () => {
  it("has all 16 principles with questions and examples", () => {
    expect(LEADERSHIP_PRINCIPLES.length).toBe(16);
    const ids = new Set(LEADERSHIP_PRINCIPLES.map((p) => p.id));
    expect(ids.size).toBe(16);
    for (const p of LEADERSHIP_PRINCIPLES) {
      expect(p.official.length).toBeGreaterThan(40);
      expect(p.questions.length).toBeGreaterThanOrEqual(1);
      expect(p.followUps.length).toBeGreaterThan(0);
      expect(p.interviewCue.length).toBeGreaterThan(20);
      expect(p.strongExample.length).toBeGreaterThan(p.weakExample.length);
    }
  });
});
