import type { StudyCourse, StudyLesson, StudyLessonsFile, StudyScenario } from "../../domain/types.ts";

/**
 * Hand-written validation of a generated lessons file against its course.
 * Used by the generation script before writing and by the unit test that
 * checks every committed file. Returns a list of problems, empty when valid.
 */
export interface Problem {
  where: string;
  message: string;
}

const MIN_PLAIN_WORDS = 45;
const MAX_PLAIN_WORDS = 140;
const MIN_TEACH_WORDS = 80;
const CHOICES = 4;
const QUESTIONS = 4;

export function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const FORBIDDEN = [/certification[- ]equivalent/i, /\bofficial (aws|amazon) (training|material)\b/i, /guarantee[sd]? (you )?pass/i];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export function validateLesson(lesson: StudyLesson, course: StudyCourse, out: Problem[]): void {
  const where = `lesson ${lesson.objectiveId}`;
  const objective = course.units.flatMap((u) => u.objectives).find((o) => o.id === lesson.objectiveId);
  if (!objective) {
    out.push({ where, message: "objective not in the catalog" });
    return;
  }
  if (objective.kind === "bookkeeping") out.push({ where, message: "bookkeeping lines get no lesson" });
  if (lesson.sourceHash !== objective.sourceHash) out.push({ where, message: `source hash ${lesson.sourceHash} does not match the catalog (${objective.sourceHash}); regenerate` });
  if (!Number.isInteger(lesson.promptVersion) || lesson.promptVersion < 1) out.push({ where, message: "promptVersion missing" });
  if (!nonEmpty(lesson.model) || !nonEmpty(lesson.generatedAt)) out.push({ where, message: "model and generatedAt required" });
  for (const field of ["plain", "guessPrompt", "teach", "explainPrompt", "modelAnswer"] as const) {
    if (!nonEmpty(lesson[field])) out.push({ where, message: `${field} is empty` });
  }
  const plainWords = words(lesson.plain ?? "");
  if (plainWords < MIN_PLAIN_WORDS || plainWords > MAX_PLAIN_WORDS) out.push({ where, message: `plain is ${plainWords} words (want ${MIN_PLAIN_WORDS}-${MAX_PLAIN_WORDS})` });
  if (/`/.test(lesson.plain ?? "")) out.push({ where, message: "plain contains code formatting" });
  if (words(lesson.teach ?? "") < MIN_TEACH_WORDS) out.push({ where, message: `teach is under ${MIN_TEACH_WORDS} words` });
  if (!Array.isArray(lesson.rubricPoints) || lesson.rubricPoints.length < 2 || lesson.rubricPoints.length > 6 || !lesson.rubricPoints.every(nonEmpty)) out.push({ where, message: "rubricPoints must be 2-6 non-empty strings" });
  if (!Array.isArray(lesson.questions) || lesson.questions.length !== QUESTIONS) {
    out.push({ where, message: `expected ${QUESTIONS} questions` });
  } else {
    const roles = lesson.questions.map((q) => q.role);
    if (roles[0] !== "fade" || roles.slice(1).some((r) => r !== "solo")) out.push({ where, message: "questions must be one fade then three solo" });
    const prompts = new Set<string>();
    lesson.questions.forEach((q, i) => {
      const qw = `${where} q${i + 1}`;
      if (q.id !== `${lesson.objectiveId}:q${i + 1}`) out.push({ where: qw, message: `id should be ${lesson.objectiveId}:q${i + 1}` });
      if (!nonEmpty(q.prompt)) out.push({ where: qw, message: "empty prompt" });
      if (prompts.has(q.prompt)) out.push({ where: qw, message: "duplicate prompt" });
      prompts.add(q.prompt);
      if (!Array.isArray(q.choices) || q.choices.length !== CHOICES || !q.choices.every(nonEmpty)) out.push({ where: qw, message: `need ${CHOICES} non-empty choices` });
      else if (new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== CHOICES) out.push({ where: qw, message: "choices repeat" });
      if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= CHOICES) out.push({ where: qw, message: "correctIndex out of range" });
      if (!nonEmpty(q.why)) out.push({ where: qw, message: "empty why" });
    });
  }
  const allText = [lesson.plain, lesson.teach, lesson.guessPrompt, lesson.explainPrompt, lesson.modelAnswer, ...(lesson.rubricPoints ?? []), ...(lesson.questions ?? []).flatMap((q) => [q.prompt, q.why, ...(q.choices ?? [])])].join("\n");
  for (const re of FORBIDDEN) if (re.test(allText)) out.push({ where, message: `text matches a forbidden claim (${re.source})` });
  if (lesson.suggested) {
    const s = lesson.suggested;
    if (!["do-existing", "do-new", "read", "combo", "explain"].includes(s.modality)) out.push({ where, message: `suggested modality ${String(s.modality)} unknown` });
    if (!nonEmpty(s.rationale)) out.push({ where, message: "suggested needs a rationale" });
  }
}

export function validateScenario(sc: StudyScenario, course: StudyCourse, out: Problem[]): void {
  const where = `scenario ${sc.unitId}`;
  const unit = course.units.find((u) => u.id === sc.unitId);
  if (!unit) {
    out.push({ where, message: "unit not in the catalog" });
    return;
  }
  if (unit.objectives.every((o) => o.kind === "bookkeeping")) out.push({ where, message: "bookkeeping units get no scenario" });
  if (!nonEmpty(sc.title) || !nonEmpty(sc.scenario)) out.push({ where, message: "title and scenario required" });
  if (!Array.isArray(sc.subParts) || sc.subParts.length < 2 || sc.subParts.length > 4 || !sc.subParts.every(nonEmpty)) out.push({ where, message: "subParts must be 2-4 labels" });
  if (!Array.isArray(sc.modelAnswer) || sc.modelAnswer.length !== (sc.subParts?.length ?? -1) || !sc.modelAnswer.every(nonEmpty)) out.push({ where, message: "modelAnswer needs one entry per sub-part" });
  for (let i = 1; i <= (sc.subParts?.length ?? 0); i++) {
    if (!new RegExp(`(^|\\n|\\s)${i}[.)]\\s`).test(sc.scenario ?? "")) out.push({ where, message: `scenario text does not number sub-task ${i}` });
  }
  if (!Number.isInteger(sc.promptVersion) || !nonEmpty(sc.model) || !nonEmpty(sc.generatedAt)) out.push({ where, message: "promptVersion, model and generatedAt required" });
}

export function validateLessonsFile(file: StudyLessonsFile, course: StudyCourse): Problem[] {
  const out: Problem[] = [];
  if (file.courseId !== course.id) out.push({ where: "file", message: `courseId ${file.courseId} is not ${course.id}` });
  if (!file.generated || !Number.isInteger(file.generated.promptVersion) || !Array.isArray(file.generated.models)) out.push({ where: "file", message: "generated metadata missing" });
  const seen = new Set<string>();
  for (const l of file.lessons ?? []) {
    if (seen.has(l.objectiveId)) out.push({ where: `lesson ${l.objectiveId}`, message: "duplicate lesson" });
    seen.add(l.objectiveId);
    validateLesson(l, course, out);
  }
  const seenUnits = new Set<string>();
  for (const s of file.scenarios ?? []) {
    if (seenUnits.has(s.unitId)) out.push({ where: `scenario ${s.unitId}`, message: "duplicate scenario" });
    seenUnits.add(s.unitId);
    validateScenario(s, course, out);
  }
  return out;
}

/** Coverage summary for the review table and the course page. */
export function lessonsCoverage(file: StudyLessonsFile | undefined, course: StudyCourse): { lessons: number; learnable: number; scenarios: number; units: number } {
  const learnable = course.units.flatMap((u) => u.objectives).filter((o) => o.kind === "objective").length;
  const units = course.units.filter((u) => u.objectives.some((o) => o.kind === "objective")).length;
  return { lessons: file?.lessons.length ?? 0, learnable, scenarios: file?.scenarios.length ?? 0, units };
}
