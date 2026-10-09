import { db } from "../../data/db";
import type { StudyAttempt, StudyObjectiveState, StudyStatus } from "../../domain/types";
import { applyStudyAttempt, emptyStudyState } from "./mastery";

/** Records one attempt on an objective and returns the stored state. */
export async function recordStudyAttempt(objectiveId: string, attempt: StudyAttempt, cap?: StudyStatus): Promise<StudyObjectiveState> {
  const current = (await db.studyObjectives.get(objectiveId)) ?? emptyStudyState(objectiveId);
  const next = applyStudyAttempt(current, attempt, cap);
  await db.studyObjectives.put(next);
  return next;
}
