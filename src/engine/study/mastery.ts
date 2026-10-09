import type { StudyAttempt, StudyCourse, StudyObjective, StudyObjectiveState, StudyStatus } from "../../domain/types";
import { SCHEMA_VERSION } from "../../domain/types";

/**
 * Objective status for the Study catalog: Ascendra's 0–4 rubric
 * ("Introduced" recognises terms, "Guided" answers multiple choice,
 * "Independent" answers open questions, "Transfer-ready" handles scenarios)
 * resolved over a history of attempts instead of the last answer alone, with
 * its 1 / 7 / 21-day review schedule. Pure functions; the store is separate.
 *
 * Rules agreed with the owner: reading alone never passes Introduced;
 * a mission or lab credit reaches Guided at most; self-rated open answers
 * may reach Independent; Transfer-ready needs two proxy-graded open or
 * scenario answers; a single miss drops at most one level.
 */
export const STUDY_STATUS_LABELS: Record<StudyStatus, string> = {
  "not-started": "Not started",
  introduced: "Introduced",
  guided: "Guided",
  independent: "Independent",
  "transfer-ready": "Transfer-ready",
  "needs-review": "Needs review",
};

export const STUDY_STATUS_MEANING: Record<StudyStatus, string> = {
  "not-started": "No attempt yet.",
  introduced: "Recognises the terms; recall is shaky.",
  guided: "Answers multiple-choice questions, or has done it in a mission.",
  independent: "Explains it in own words against the model answer.",
  "transfer-ready": "Handles scenarios; two open answers graded by the proxy.",
  "needs-review": "Recent misses; a review is scheduled.",
};

export const STUDY_STATUS_SCORE: Record<StudyStatus, number> = {
  "not-started": 0,
  introduced: 1,
  guided: 2,
  independent: 3,
  "transfer-ready": 4,
  "needs-review": 1,
};

const LEVELS: StudyStatus[] = ["not-started", "introduced", "guided", "independent", "transfer-ready"];
export const REVIEW_OFFSETS_DAYS = [1, 7, 21] as const;
const MAX_ATTEMPTS_KEPT = 30;

export function emptyStudyState(objectiveId: string): StudyObjectiveState {
  const [courseId, unitIndex] = objectiveId.split(":");
  return {
    objectiveId,
    courseId,
    unitId: `${courseId}:${unitIndex}`,
    schemaVersion: SCHEMA_VERSION,
    status: "not-started",
    score: 0,
    attempts: [],
    seenQuestionIds: [],
    reviewStage: 0,
    nextReviewAt: null,
    lastPracticedAt: null,
  };
}

function value(v: StudyAttempt["verdict"]): number {
  return v === "correct" ? 1 : v === "partial" ? 0.5 : 0;
}

function rate(attempts: StudyAttempt[]): number {
  return attempts.length ? attempts.reduce((a, x) => a + value(x.verdict), 0) / attempts.length : 0;
}

/** Ascendra's proficiency bar: at least two attempts and 85% correct. */
export function isProficient(attempts: StudyAttempt[]): boolean {
  return attempts.length >= 2 && rate(attempts) >= 0.85;
}

/** The highest status an objective can reach before its hands-on part exists. */
export function statusCap(objective: Pick<StudyObjective, "modality" | "kind">): StudyStatus | undefined {
  if (objective.kind === "bookkeeping") return "not-started";
  if (objective.modality === "do-new") return "independent";
  return undefined;
}

function rawLevel(attempts: StudyAttempt[]): StudyStatus {
  if (attempts.length === 0) return "not-started";
  const last = attempts[attempts.length - 1];
  const recent = attempts.slice(-4);
  const twoMisses = attempts.length >= 2 && last.verdict === "incorrect" && attempts[attempts.length - 2].verdict === "incorrect";
  if ((last.verdict === "incorrect" && recent.length >= 2 && rate(recent) < 0.5) || twoMisses) return "needs-review";
  const mcRecent = attempts.filter((a) => a.format === "mc").slice(-4);
  const guidedByMc = mcRecent.length >= 2 && rate(mcRecent) >= 0.75;
  const credited = attempts.some((a) => (a.format === "mission" || a.format === "lab") && a.verdict === "correct");
  const openCorrect = attempts.filter((a) => (a.format === "open" || a.format === "pbq") && a.verdict === "correct");
  const proxyOpenCorrect = openCorrect.filter((a) => a.source === "proxy").length;
  let level: StudyStatus = "introduced";
  if (guidedByMc || credited || openCorrect.length > 0) level = "guided";
  if (level === "guided" && openCorrect.length >= 1) level = "independent";
  if (level === "independent" && isProficient(attempts) && proxyOpenCorrect >= 2 && last.verdict === "correct") level = "transfer-ready";
  return level;
}

function capLevel(level: StudyStatus, cap: StudyStatus | undefined): StudyStatus {
  if (!cap || level === "needs-review") return level;
  return STUDY_STATUS_SCORE[level] > STUDY_STATUS_SCORE[cap] ? cap : level;
}

/**
 * Status from the attempt history. A miss can lower the status by one
 * level at most, so one bad day does not erase a mastered objective;
 * "needs-review" is reached only from Guided or below.
 */
export function resolveStatus(attempts: StudyAttempt[], cap?: StudyStatus): StudyStatus {
  const now = capLevel(rawLevel(attempts), cap);
  if (attempts.length === 0 || attempts[attempts.length - 1].verdict !== "incorrect") return now;
  const before = capLevel(rawLevel(attempts.slice(0, -1)), cap);
  const floor = Math.max(0, STUDY_STATUS_SCORE[before] - 1);
  if (STUDY_STATUS_SCORE[now] >= floor) return now;
  return LEVELS[floor];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * Appends an attempt and recomputes status, score and the review schedule.
 * A miss (re)starts the schedule at 1 day; a correct answer while a review
 * is pending advances it (7, then 21 days, then resolved). Mission and lab
 * credits never touch the schedule.
 */
export function applyStudyAttempt(state: StudyObjectiveState, attempt: StudyAttempt, cap?: StudyStatus): StudyObjectiveState {
  const attempts = [...state.attempts, attempt].slice(-MAX_ATTEMPTS_KEPT);
  const status = resolveStatus(attempts, cap);
  const next: StudyObjectiveState = { ...state, attempts, status, score: STUDY_STATUS_SCORE[status], lastPracticedAt: attempt.at };
  if (attempt.questionId && !next.seenQuestionIds.includes(attempt.questionId)) next.seenQuestionIds = [...next.seenQuestionIds, attempt.questionId];
  const graded = attempt.format === "mc" || attempt.format === "open" || attempt.format === "pbq";
  if (!graded) return next;
  if (attempt.verdict === "incorrect") {
    next.reviewStage = 0;
    next.nextReviewAt = addDays(attempt.at, REVIEW_OFFSETS_DAYS[0]);
  } else if (state.nextReviewAt) {
    const stage = state.reviewStage + 1;
    next.reviewStage = stage;
    next.nextReviewAt = stage < REVIEW_OFFSETS_DAYS.length ? addDays(attempt.at, REVIEW_OFFSETS_DAYS[stage]) : null;
  }
  return next;
}

/** Objectives whose scheduled review is due, soonest first. */
export function dueStudyReviews(states: Iterable<StudyObjectiveState>, now = new Date()): StudyObjectiveState[] {
  const t = now.toISOString();
  return [...states].filter((s) => s.nextReviewAt && s.nextReviewAt <= t).sort((a, b) => (a.nextReviewAt ?? "").localeCompare(b.nextReviewAt ?? ""));
}

export function isMastered(status: StudyStatus): boolean {
  return status === "independent" || status === "transfer-ready";
}

export interface CourseReadiness {
  /** 0–100 */
  percent: number;
  /** "readiness" is weighted by exam domain weight; "coverage" is a plain fraction. */
  kind: "readiness" | "coverage";
  mastered: number;
  total: number;
}

/**
 * Ascendra's exam readiness: per-unit mastered fraction weighted by the
 * published domain weight, when at least two units carry weights; otherwise
 * plain coverage. Mastered means Independent or Transfer-ready; bookkeeping
 * lines never count.
 */
export function courseReadiness(course: Pick<StudyCourse, "units">, states: Map<string, StudyObjectiveState>): CourseReadiness {
  const units = course.units.map((u) => {
    const objectives = u.objectives.filter((o) => o.kind === "objective");
    const mastered = objectives.filter((o) => isMastered(states.get(o.id)?.status ?? "not-started")).length;
    return { weight: u.weight, total: objectives.length, mastered };
  });
  const total = units.reduce((a, u) => a + u.total, 0);
  const mastered = units.reduce((a, u) => a + u.mastered, 0);
  const weighted = units.filter((u) => u.weight !== undefined && u.weight > 0 && u.total > 0);
  if (weighted.length >= 2) {
    const totalWeight = weighted.reduce((a, u) => a + (u.weight as number), 0);
    const score = weighted.reduce((a, u) => a + (u.weight as number) * (u.mastered / u.total), 0);
    return { percent: Math.round((score / totalWeight) * 100), kind: "readiness", mastered, total };
  }
  return { percent: total ? Math.round((mastered / total) * 100) : 0, kind: "coverage", mastered, total };
}
