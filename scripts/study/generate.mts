/**
 * Lesson generation against the Anthropic API. Runs only on a developer's
 * machine with ANTHROPIC_API_KEY; CI never calls it. Resumable: the lessons
 * file is rewritten atomically every few objectives, and an objective is
 * regenerated only when it has no lesson, its text changed (sourceHash) or
 * the prompts changed (promptVersion), unless --force.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StudyChoiceQuestion, StudyCourse, StudyLesson, StudyLessonsFile, StudyScenario, StudyUnit } from "../../src/domain/types.ts";
import { validateLesson, validateLessonsFile, validateScenario, type Problem } from "../../src/services/study/validate.ts";
import { BANK_SCHEMA, LESSON_SCHEMA, PROMPT_VERSION, SCENARIO_SCHEMA, SCRIPT_VERSION, bankPrompt, lessonPrompt, scenarioPrompt, type LessonContext } from "./prompts.mts";

export interface GenerateOptions {
  course: StudyCourse;
  outFile: string;
  failuresFile: string;
  model: string;
  unit?: number;
  limit?: number;
  concurrency: number;
  force: boolean;
  dryRun: boolean;
  missions: LessonContext["missions"];
  engines: LessonContext["engines"];
  log: (line: string) => void;
}

export function readLessonsFile(file: string, courseId: string): StudyLessonsFile {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as StudyLessonsFile;
  return { courseId, generated: { scriptVersion: SCRIPT_VERSION, promptVersion: PROMPT_VERSION, generatedAt: new Date().toISOString(), models: [] }, lessons: [], scenarios: [] };
}

export function writeAtomic(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, file);
}

/** Deterministic shuffle keyed on a string so a bank's choice order is stable across runs. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function toQuestion(id: string, role: StudyChoiceQuestion["role"], q: { prompt: string; choices: string[]; correctIndex: number; why: string }): StudyChoiceQuestion {
  const order = seededShuffle([0, 1, 2, 3], id);
  return { id, role, prompt: q.prompt, choices: order.map((i) => q.choices[i]), correctIndex: order.indexOf(q.correctIndex), why: q.why };
}

export function needsLesson(existing: StudyLesson | undefined, objective: { sourceHash: string }, force: boolean): boolean {
  if (force || !existing) return true;
  return existing.sourceHash !== objective.sourceHash || existing.promptVersion !== PROMPT_VERSION;
}

export function needsScenario(existing: StudyScenario | undefined, force: boolean): boolean {
  return force || !existing || existing.promptVersion !== PROMPT_VERSION;
}

/**
 * The schema as structured outputs accepts it. The API rejects numeric and
 * string bounds and any minItems above 1, so those are dropped here and
 * restated in the field description; validateLesson/validateScenario still
 * enforce them on what comes back.
 */
export function apiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(apiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems"].includes(k)) continue;
    if (k === "minItems" && typeof v === "number" && v > 1) continue;
    out[k] = apiSchema(v);
  }
  const min = src.minItems as number | undefined;
  const max = src.maxItems as number | undefined;
  const lo = src.minimum as number | undefined;
  const hi = src.maximum as number | undefined;
  const bound =
    min !== undefined && min === max ? `Exactly ${min} items.`
    : min !== undefined || max !== undefined ? `Between ${min ?? 0} and ${max ?? "any number of"} items.`
    : lo !== undefined || hi !== undefined ? `From ${lo ?? "any"} to ${hi ?? "any"}.`
    : "";
  if (bound) out.description = typeof src.description === "string" ? `${src.description} ${bound}` : bound;
  return out;
}

type Client = InstanceType<typeof Anthropic>;

/** Models that accept the server-side `fallbacks: "default"` parameter. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

/** Tokens billed by this process, failed replies included, so a run can report what it actually spent. */
export const usage = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** Dollars per million tokens. Only models listed here get a cost line; check the Console for the bill itself. */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  // Haiku 5.5's rate for prompts up to 100K tokens; lesson prompts are far below that.
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function usageCost(model: string): number | undefined {
  const p = PRICES[model];
  if (!p) return undefined;
  return (usage.input * p.input + usage.cacheWrite * p.input * 1.25 + usage.cacheRead * p.input * 0.1 + usage.output * p.output) / 1e6;
}

async function structured<T>(client: Client, model: string, system: string, user: string, schema: object, maxTokens: number): Promise<{ data: T; model: string }> {
  let attempt = 0;
  for (;;) {
    try {
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        output_config: { effort: "medium", format: { type: "json_schema", schema: apiSchema(schema) } },
        messages: [{ role: "user", content: user }],
        // Opus 5.5's safety filter declines some security-testing objectives (PenTest+). With fallbacks on,
        // the API re-runs a declined request on a model chosen for that refusal category, in the same call;
        // msg.model then names the model that wrote the lesson. Haiku has no server-side fallback.
        ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      } as never);
      const msg = response as unknown as { stop_reason: string; content: Array<{ type: string; text?: string }>; model: string; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } };
      usage.calls += 1;
      usage.input += msg.usage?.input_tokens ?? 0;
      usage.output += msg.usage?.output_tokens ?? 0;
      usage.cacheRead += msg.usage?.cache_read_input_tokens ?? 0;
      usage.cacheWrite += msg.usage?.cache_creation_input_tokens ?? 0;
      if (msg.stop_reason === "refusal") throw new Error("the model declined this request");
      // Thinking counts against max_tokens, so a low cap cuts the JSON off mid-string.
      if (msg.stop_reason === "max_tokens") throw new Error(`reply cut off at max_tokens (${maxTokens}); raise the limit for this call`);
      const text = msg.content.find((b) => b.type === "text")?.text ?? "";
      return { data: JSON.parse(text) as T, model: msg.model };
    } catch (e) {
      const status = (e as { status?: number }).status;
      attempt += 1;
      if ((status === 429 || status === 529 || status === 500) && attempt <= 5) {
        const wait = Math.min(60_000, 2_000 * 2 ** attempt);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

export async function generateCourse(opts: GenerateOptions): Promise<{ generated: number; scenarios: number; failures: number; problems: Problem[] }> {
  const { course } = opts;
  const file = readLessonsFile(opts.outFile, course.id);
  const byObjective = new Map(file.lessons.map((l) => [l.objectiveId, l]));
  const byUnit = new Map(file.scenarios.map((s) => [s.unitId, s]));
  const units = course.units.filter((u) => (opts.unit === undefined || u.index === opts.unit) && u.objectives.some((o) => o.kind === "objective"));
  let todo = units.flatMap((u) => u.objectives.filter((o) => o.kind === "objective" && needsLesson(byObjective.get(o.id), o, opts.force)).map((o) => ({ unit: u, objective: o })));
  if (opts.limit !== undefined) todo = todo.slice(0, opts.limit);
  const scenarioTodo = units.filter((u) => needsScenario(byUnit.get(u.id), opts.force));

  opts.log(`${course.id}: ${todo.length} lesson(s) and ${opts.limit === undefined ? scenarioTodo.length : 0} scenario(s) to generate (${byObjective.size} lessons already present)`);
  if (opts.dryRun) {
    const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
    let chars = 0;
    for (const { unit, objective } of todo) {
      const p = lessonPrompt({ course, unit, objective, missions: opts.missions, engines: opts.engines });
      chars += p.system.length + p.user.length;
    }
    opts.log(`prompt text for the lesson calls: ${chars.toLocaleString()} characters (about ${Math.round(chars / 4).toLocaleString()} input tokens, before the bank and scenario calls)`);
    if (client && todo.length) {
      const { unit, objective } = todo[0];
      const p = lessonPrompt({ course, unit, objective, missions: opts.missions, engines: opts.engines });
      const count = await client.messages.countTokens({ model: opts.model, system: p.system, messages: [{ role: "user", content: p.user }] });
      opts.log(`measured input tokens for the first lesson call: ${count.input_tokens}`);
    }
    return { generated: 0, scenarios: 0, failures: 0, problems: [] };
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Generation runs only on a machine with the owner's key.");
  const client = new Anthropic();
  const failures: Array<{ id: string; error: string; at: string }> = [];
  const models = new Set(file.generated.models);
  let done = 0;
  let sinceWrite = 0;
  const flush = () => {
    file.lessons = [...byObjective.values()].sort((a, b) => a.objectiveId.localeCompare(b.objectiveId, undefined, { numeric: true }));
    file.scenarios = [...byUnit.values()].sort((a, b) => a.unitId.localeCompare(b.unitId, undefined, { numeric: true }));
    file.generated = { scriptVersion: SCRIPT_VERSION, promptVersion: PROMPT_VERSION, generatedAt: new Date().toISOString(), models: [...models].sort() };
    writeAtomic(opts.outFile, file);
    sinceWrite = 0;
  };

  await mapLimit(todo, opts.concurrency, async ({ unit, objective }) => {
    const ctx: LessonContext = { course, unit, objective, missions: opts.missions, engines: opts.engines };
    try {
      const a = lessonPrompt(ctx);
      const lessonPart = await structured<{ plain: string; guessPrompt: string; teach: string; explainPrompt: string; modelAnswer: string; rubricPoints: string[]; suggested: StudyLesson["suggested"] }>(client, opts.model, a.system, a.user, LESSON_SCHEMA, 16000);
      const b = bankPrompt(ctx, lessonPart.data.teach);
      const bank = await structured<{ fade: { prompt: string; choices: string[]; correctIndex: number; why: string }; solo: Array<{ prompt: string; choices: string[]; correctIndex: number; why: string }> }>(client, opts.model, b.system, b.user, BANK_SCHEMA, 16000);
      const lesson: StudyLesson = {
        objectiveId: objective.id,
        sourceHash: objective.sourceHash,
        promptVersion: PROMPT_VERSION,
        model: lessonPart.model,
        generatedAt: new Date().toISOString(),
        // The plain paragraph is prose for beginners; objective text like "`this` in call contexts" invites backticks.
        plain: lessonPart.data.plain.replace(/`/g, ""),
        guessPrompt: lessonPart.data.guessPrompt,
        teach: lessonPart.data.teach,
        questions: [toQuestion(`${objective.id}:q1`, "fade", bank.data.fade), ...bank.data.solo.map((q, i) => toQuestion(`${objective.id}:q${i + 2}`, "solo", q))],
        explainPrompt: lessonPart.data.explainPrompt,
        modelAnswer: lessonPart.data.modelAnswer,
        rubricPoints: lessonPart.data.rubricPoints,
        suggested: lessonPart.data.suggested,
      };
      const problems: Problem[] = [];
      validateLesson(lesson, course, problems);
      if (problems.length) throw new Error(problems.map((p) => p.message).join("; "));
      byObjective.set(objective.id, lesson);
      models.add(lessonPart.model);
      models.add(bank.model);
      done += 1;
      sinceWrite += 1;
      opts.log(`  ok ${objective.id} (${done}/${todo.length}) ${objective.text.slice(0, 60)}`);
      if (sinceWrite >= 10) flush();
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failures.push({ id: objective.id, error, at: new Date().toISOString() });
      opts.log(`  FAIL ${objective.id}: ${error}`);
    }
  });

  let scenarios = 0;
  if (opts.limit === undefined) {
    await mapLimit(scenarioTodo, opts.concurrency, async (unit: StudyUnit) => {
      try {
        const c = scenarioPrompt(course, unit);
        const r = await structured<{ title: string; scenario: string; subParts: string[]; modelAnswer: string[] }>(client, opts.model, c.system, c.user, SCENARIO_SCHEMA, 16000);
        const sc: StudyScenario = { unitId: unit.id, promptVersion: PROMPT_VERSION, model: r.model, generatedAt: new Date().toISOString(), ...r.data };
        const problems: Problem[] = [];
        validateScenario(sc, course, problems);
        if (problems.length) throw new Error(problems.map((p) => p.message).join("; "));
        byUnit.set(unit.id, sc);
        models.add(r.model);
        scenarios += 1;
        opts.log(`  ok scenario ${unit.id} ${unit.title}`);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        failures.push({ id: unit.id, error, at: new Date().toISOString() });
        opts.log(`  FAIL scenario ${unit.id}: ${error}`);
      }
    });
  }

  flush();
  if (failures.length) writeAtomic(opts.failuresFile, failures);
  const problems = validateLessonsFile(file, course);
  return { generated: done, scenarios, failures: failures.length, problems };
}

/** Table of the generator's modality suggestions that differ from the catalog, for promotion into links.ts. */
export function reviewTable(file: StudyLessonsFile, course: StudyCourse): string[] {
  const rows: string[] = [];
  const objectives = new Map(course.units.flatMap((u) => u.objectives).map((o) => [o.id, o]));
  for (const l of file.lessons) {
    const o = objectives.get(l.objectiveId);
    if (!o || !l.suggested) continue;
    if (l.suggested.modality === o.modality && (l.suggested.missionId ?? "") === (o.link?.kind === "mission" ? o.link.missionId : "")) continue;
    rows.push(`${l.objectiveId}\t${o.modality}(${o.modalitySource}) -> ${l.suggested.modality}${l.suggested.missionId ? ` ${l.suggested.missionId}` : ""}${l.suggested.engineId ? ` ${l.suggested.engineId}` : ""}\t${o.text.slice(0, 70)}\t${l.suggested.rationale}`);
  }
  return rows;
}
