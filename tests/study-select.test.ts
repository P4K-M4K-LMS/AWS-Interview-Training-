import { describe, expect, it } from "vitest";
import { applyStudyAttempt, emptyStudyState } from "../src/engine/study/mastery";
import { orderObjectives, pickQuestion, presentQuestion } from "../src/engine/study/select";
import type { StudyChoiceQuestion } from "../src/domain/types";

const q = (n: number, role: "fade" | "solo" = "solo"): StudyChoiceQuestion => ({ id: `o:q${n}`, role, prompt: `p${n}`, choices: ["a", "b", "c", "d"], correctIndex: 2, why: "w" });
const bank = [q(1, "fade"), q(2), q(3), q(4)];

describe("Study question selection", () => {
  it("serves the fade question first, then unseen solo questions, then the least recently answered", () => {
    let s = emptyStudyState("o");
    expect(pickQuestion(bank, undefined)?.id).toBe("o:q1");
    expect(pickQuestion(bank, s)?.id).toBe("o:q1");
    s = applyStudyAttempt(s, { at: "2026-10-01T00:00:00.000Z", format: "mc", verdict: "correct", source: "auto", questionId: "o:q1" });
    expect(pickQuestion(bank, s)?.id).toBe("o:q2");
    for (const [id, at] of [["o:q2", "2026-10-02"], ["o:q3", "2026-10-03"], ["o:q4", "2026-10-04"]] as const) {
      s = applyStudyAttempt(s, { at: `${at}T00:00:00.000Z`, format: "mc", verdict: "correct", source: "auto", questionId: id });
    }
    // All seen: the one answered longest ago comes back first.
    expect(pickQuestion(bank, s)?.id).toBe("o:q1");
    s = applyStudyAttempt(s, { at: "2026-10-05T00:00:00.000Z", format: "mc", verdict: "incorrect", source: "auto", questionId: "o:q1" });
    expect(pickQuestion(bank, s)?.id).toBe("o:q2");
    expect(pickQuestion([], s)).toBeUndefined();
  });

  it("reshuffles choices per presentation and keeps the key aligned", () => {
    const seq = [0.9, 0.1, 0.5];
    let i = 0;
    const p = presentQuestion(q(1), () => seq[i++ % seq.length]);
    expect(p.choices).toHaveLength(4);
    expect([...p.choices].sort()).toEqual(["a", "b", "c", "d"]);
    expect(p.choices[p.correctShown]).toBe("c");
    expect(p.key[p.correctShown]).toBe(2);
    const seen = new Set<string>();
    for (let n = 0; n < 50; n++) seen.add(presentQuestion(q(1)).choices.join(""));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("orders objectives by study style without dropping any", () => {
    const objs = [
      { index: 1, modality: "read" as const },
      { index: 2, modality: "do-existing" as const },
      { index: 3, modality: "explain" as const },
      { index: 4, modality: "do-new" as const },
      { index: 5, modality: "read" as const },
    ];
    expect(orderObjectives(objs, undefined).map((o) => o.index)).toEqual([1, 2, 3, 4, 5]);
    expect(orderObjectives(objs, "mixed").map((o) => o.index)).toEqual([1, 2, 3, 4, 5]);
    expect(orderObjectives(objs, "doing").map((o) => o.index)).toEqual([2, 4, 3, 1, 5]);
    expect(orderObjectives(objs, "reading").map((o) => o.index)).toEqual([1, 5, 3, 2, 4]);
  });
});
