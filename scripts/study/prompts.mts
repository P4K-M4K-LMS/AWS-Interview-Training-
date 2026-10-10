/**
 * Prompts and output schemas for Study lesson generation. Ported from
 * Ascendra's coach rules and lesson prompts with the fixes the review
 * called for: the model sees the course, unit, gate, weight and neighbouring
 * objectives (not the title alone); a beginner "plain" paragraph in the style
 * of OpsForge's mission primers; a four-question bank instead of two fixed
 * questions; a model answer and rubric so graders see the key; vendor
 * neutrality for anything OpsForge would build. Bump PROMPT_VERSION whenever
 * wording here changes so stale lessons are regenerated.
 */
import type { StudyCourse, StudyField, StudyObjective, StudyUnit } from "../../src/domain/types.ts";

export const PROMPT_VERSION = 2;
export const SCRIPT_VERSION = 1;

export interface LessonContext {
  course: StudyCourse;
  unit: StudyUnit;
  objective: StudyObjective;
  /** Mission ids and titles the model may suggest as "do-existing". */
  missions: Array<{ id: string; title: string }>;
  /** Planned engine ids and names it may suggest as "do-new". */
  engines: Array<{ id: string; name: string }>;
}

/**
 * Who the learner is, by field. The technology fields keep the original
 * wording, so the lessons already generated under PROMPT_VERSION 2 are not
 * stale; the other fields had no lessons when their wording was added.
 */
const AUDIENCE: Partial<Record<StudyField, string>> = {
  pm: "The learner is an adult beginner moving into a project management role.",
  nursing: "The learner is an adult student preparing for a nursing exam or programme.",
  pt: "The learner is an adult student preparing for a physical therapy exam or programme.",
  fitness: "The learner is an adult beginner preparing for a fitness professional certification.",
};
const ENGINEERING_AUDIENCE = "The learner is an adult beginner moving into an engineering job.";

/** Extra rules for courses where acting on a wrong answer can hurt someone. */
const HEALTH_RULES = `
- This is exam preparation, not clinical guidance. Teach the principle the exam tests; do not give individual medical, dosing or treatment advice, and never invent a drug dose, lab value, protocol number or guideline name you are not certain of.
- Where practice differs by country, state, facility or current guideline, say so in one sentence and teach the widely taught exam answer.
- Use only fictional patients and clients, never a real person.`;

function rules(c: StudyCourse): string {
  const health = c.field === "nursing" || c.field === "pt" || c.field === "fitness";
  return RULES.replace(ENGINEERING_AUDIENCE, AUDIENCE[c.field] ?? ENGINEERING_AUDIENCE).replace("\n- Output only the JSON", `${health ? HEALTH_RULES : ""}\n- Output only the JSON`);
}

const RULES = `You write study material for OpsForge, a free, unofficial training site. ${ENGINEERING_AUDIENCE} Rules, always:
- Plain language. Define every named term on first use, never just the first one.
- Lead with the direct definition, then why it works, one short worked example traced step by step, one common mistake, and the consequence for a running system where that matters.
- Stay inside the objective and the course's scope. Any question you write must be answerable from your own teaching text alone.
- Never copy or closely paraphrase vendor documentation or exam text; explain in your own words.
- Never claim or imply that studying here equals a certification, a credit or job experience, and never promise an exam result.
- Where the objective names a vendor product, you may use the product's name because the course is about that exam, but describe what the thing does in generic terms too (a managed queue, a virtual network, an authorization policy) so the idea transfers.
- No markdown headings or bullet lists inside fields; short paragraphs are fine. No code fences in the "plain" field.
- Output only the JSON the schema asks for.`;

function courseFraming(c: StudyCourse, u: StudyUnit): string {
  const lines = [`Course: ${c.title} (${c.provenance.examCode ?? c.code}). ${c.description}`, `Unit ${u.index}: ${u.title}${u.weight !== undefined ? ` (${u.weight}% of the exam)` : ""}${u.rangeLabel ? ` [${u.rangeLabel}]` : ""}`];
  if (u.gate) lines.push(`What mastering this unit means: ${u.gate}`);
  return lines.join("\n");
}

function neighbours(u: StudyUnit, o: StudyObjective): string {
  const others = u.objectives.filter((x) => x.id !== o.id && x.kind === "objective").map((x) => `- ${x.text}`);
  return others.length ? `Other objectives in this unit (for scope; do not teach them here):\n${others.join("\n")}` : "";
}

export const LESSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plain", "guessPrompt", "teach", "explainPrompt", "modelAnswer", "rubricPoints", "suggested"],
  properties: {
    plain: { type: "string", description: "60-110 words. What this is, in everyday words, for someone who has never met the idea; one analogy is welcome. No code, no product-specific steps." },
    guessPrompt: { type: "string", description: "One concrete question the learner can attempt from intuition before any teaching. Not a trick." },
    teach: { type: "string", description: "150-350 words. Every named term defined; why it works; one worked example traced step by step; one common mistake; the consequence in a running system if relevant. Ends with a statement, not a question." },
    explainPrompt: { type: "string", description: "Asks the learner to explain the idea in their own words to a teammate, naming a limit or tradeoff." },
    modelAnswer: { type: "string", description: "80-160 words. The answer a strong learner would give to explainPrompt." },
    rubricPoints: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" }, description: "The 2-6 points a good explanation covers, each one short sentence." },
    suggested: {
      type: "object",
      additionalProperties: false,
      required: ["modality", "rationale"],
      properties: {
        modality: { type: "string", enum: ["do-existing", "do-new", "read", "combo", "explain"], description: "How this objective is best learned on OpsForge: do-existing if a listed mission already makes the learner do it; do-new if a listed planned engine would; combo if an exam-style situation to reason through adds the most; explain if explaining it back is the core skill; read otherwise (facts, product catalogue, pricing, console steps)." },
        missionId: { type: "string", description: "Only with do-existing: one id from the mission list." },
        engineId: { type: "string", description: "Only with do-new: one id from the engine list." },
        rationale: { type: "string", description: "One sentence." },
      },
    },
  },
} as const;

export const BANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fade", "solo"],
  properties: {
    fade: {
      type: "object",
      additionalProperties: false,
      required: ["prompt", "choices", "correctIndex", "why"],
      properties: {
        prompt: { type: "string", description: "A new example of the same idea in a situation the teaching text does not use, mostly worked through, with exactly one missing step stated unambiguously. Never the worked example from the teaching text with a step removed." },
        choices: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" }, description: "Four candidate completions: one correct, three real misconceptions or near-misses. No filler." },
        correctIndex: { type: "integer", minimum: 0, maximum: 3 },
        why: { type: "string", description: "One sentence on why the correct choice is correct." },
      },
    },
    solo: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "choices", "correctIndex", "why"],
        properties: {
          prompt: { type: "string", description: "A standalone question or small problem inside the objective's scope, different from the others in angle (definition, application, failure case)." },
          choices: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          why: { type: "string" },
        },
      },
    },
  },
} as const;

export const SCENARIO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "scenario", "subParts", "modelAnswer"],
  properties: {
    title: { type: "string", description: "Short scenario title." },
    scenario: { type: "string", description: "A realistic situation at a fictional company, written for a beginner, ending with 2-4 sub-tasks numbered '1.', '2.' and so on, each answerable from the unit's objectives." },
    subParts: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" }, description: "One short label per numbered sub-task, same order." },
    modelAnswer: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" }, description: "One model answer per sub-task, same order; the grader's key." },
  },
} as const;

export function lessonPrompt(ctx: LessonContext): { system: string; user: string } {
  const missions = ctx.missions.map((m) => `- ${m.id}: ${m.title}`).join("\n");
  const engines = ctx.engines.map((e) => `- ${e.id}: ${e.name}`).join("\n");
  const user = `${courseFraming(ctx.course, ctx.unit)}

Objective to teach: ${ctx.objective.text}

${neighbours(ctx.unit, ctx.objective)}

OpsForge missions the learner can do today (for the "suggested" field only):
${missions}

Hands-on engines OpsForge plans to build (for the "suggested" field only):
${engines}

Write the lesson for this one objective as the schema describes.`;
  return { system: `${rules(ctx.course)}\n\nYou are writing the teaching half of a lesson that is stored once and reused, so it must stand alone.`, user };
}

export function bankPrompt(ctx: LessonContext, teach: string): { system: string; user: string } {
  const user = `${courseFraming(ctx.course, ctx.unit)}

Objective: ${ctx.objective.text}

The teaching text the learner has read (your questions must be answerable from it alone):
"""
${teach}
"""

Write one "fade" question and three "solo" questions as the schema describes. Each question has exactly four choices. Vary the correct position; never make the longest choice the correct one by habit.

Every question, the fade question included, must use a situation that does not appear in the teaching text: a different organisation, different resources and different numbers. Do not restate the worked example or any list of steps from the teaching text with one item removed; a learner must be able to answer by applying the idea, not by remembering what they just read.`;
  return { system: `${rules(ctx.course)}\n\nYou are writing the check-question bank for one objective. The questions are served one at a time, unseen ones first, and again as spaced reviews, so they must each stand alone.`, user };
}

export function scenarioPrompt(course: StudyCourse, unit: StudyUnit): { system: string; user: string } {
  const objectives = unit.objectives.filter((o) => o.kind === "objective").map((o) => `- ${o.text}`).join("\n");
  const user = `${courseFraming(course, unit)}

Objectives this unit covers:
${objectives}

Write one multi-part scenario for this unit as the schema describes. Set it at a fictional company, not at any real organisation.`;
  return { system: `${rules(course)}\n\nYou are writing a performance-style scenario: one realistic situation with 2-4 numbered sub-tasks, graded per sub-task against your model answers.`, user };
}
