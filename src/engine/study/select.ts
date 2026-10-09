import type { StudyChoiceQuestion, StudyModality, StudyObjective, StudyObjectiveState, StudyStyle } from "../../domain/types";

/**
 * Which check question to serve next: an unseen one first (the fade question
 * before the solo ones on a first visit), then the least recently answered.
 * Pure, so the player and the tests agree.
 */
export function pickQuestion(questions: StudyChoiceQuestion[], state: StudyObjectiveState | undefined): StudyChoiceQuestion | undefined {
  if (!questions.length) return undefined;
  const seen = new Set(state?.seenQuestionIds ?? []);
  const unseen = questions.find((q) => !seen.has(q.id));
  if (unseen) return unseen;
  const lastAt = new Map<string, string>();
  for (const a of state?.attempts ?? []) if (a.questionId) lastAt.set(a.questionId, a.at);
  return [...questions].sort((a, b) => (lastAt.get(a.id) ?? "").localeCompare(lastAt.get(b.id) ?? ""))[0];
}

/** A presentation of a question with its choices reshuffled; `key` maps the shown index back to the stored one. */
export interface Presented {
  question: StudyChoiceQuestion;
  choices: string[];
  /** shown index -> original index */
  key: number[];
  correctShown: number;
}

export function presentQuestion(question: StudyChoiceQuestion, random: () => number = Math.random): Presented {
  const key = question.choices.map((_, i) => i);
  for (let i = key.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [key[i], key[j]] = [key[j], key[i]];
  }
  return { question, choices: key.map((i) => question.choices[i]), key, correctShown: key.indexOf(question.correctIndex) };
}

const DOING_FIRST: StudyModality[] = ["do-existing", "do-new", "combo", "explain", "read"];
const READING_FIRST: StudyModality[] = ["read", "explain", "combo", "do-existing", "do-new"];

/** Objective order for a unit under the learner's study style; stable within a modality. */
export function orderObjectives<T extends Pick<StudyObjective, "modality" | "index">>(objectives: T[], style: StudyStyle | undefined): T[] {
  if (!style || style === "mixed") return [...objectives].sort((a, b) => a.index - b.index);
  const rank = style === "doing" ? DOING_FIRST : READING_FIRST;
  return [...objectives].sort((a, b) => rank.indexOf(a.modality) - rank.indexOf(b.modality) || a.index - b.index);
}
