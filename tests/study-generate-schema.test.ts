import { describe, expect, it } from "vitest";
import { apiSchema } from "../scripts/study/generate.mts";
import { BANK_SCHEMA, LESSON_SCHEMA, SCENARIO_SCHEMA } from "../scripts/study/prompts.mts";

const UNSUPPORTED = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems"];

function offenders(node: unknown, at = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => offenders(n, `${at}[${i}]`));
  if (!node || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => [
    ...(UNSUPPORTED.includes(k) || (k === "minItems" && typeof v === "number" && v > 1) ? [`${at}.${k}`] : []),
    ...offenders(v, `${at}.${k}`),
  ]);
}

describe("apiSchema", () => {
  it("leaves no bound the structured-outputs API rejects in any schema we send", () => {
    for (const s of [LESSON_SCHEMA, BANK_SCHEMA, SCENARIO_SCHEMA]) expect(offenders(apiSchema(s))).toEqual([]);
  });

  it("restates the dropped bounds in the description so the model still sees them", () => {
    const bank = apiSchema(BANK_SCHEMA) as { properties: { fade: { properties: { choices: { description: string }; correctIndex: { description: string } } }; solo: { description: string } } };
    expect(bank.properties.fade.properties.choices.description).toMatch(/Four candidate completions.*Exactly 4 items\.$/);
    expect(bank.properties.fade.properties.correctIndex.description).toBe("From 0 to 3.");
    expect(bank.properties.solo.description).toBe("Exactly 3 items.");
    const lesson = apiSchema(LESSON_SCHEMA) as { properties: { rubricPoints: { description: string } } };
    expect(lesson.properties.rubricPoints.description).toMatch(/Between 2 and 6 items\.$/);
  });

  it("does not change the schema it was given", () => {
    const before = JSON.stringify(BANK_SCHEMA);
    apiSchema(BANK_SCHEMA);
    expect(JSON.stringify(BANK_SCHEMA)).toBe(before);
  });
});
