import { db } from "../../data/db";
import { SCHEMA_VERSION, type StudyAttempt, type StudyObjectiveState, type StudyStatus, type StudyUnitState } from "../../domain/types";
import { applyStudyAttempt, emptyStudyState } from "./mastery";

/** Records one attempt on an objective and returns the stored state. */
export async function recordStudyAttempt(objectiveId: string, attempt: StudyAttempt, cap?: StudyStatus): Promise<StudyObjectiveState> {
  const current = (await db.studyObjectives.get(objectiveId)) ?? emptyStudyState(objectiveId);
  const next = applyStudyAttempt(current, attempt, cap);
  await db.studyObjectives.put(next);
  return next;
}

/** Records a unit scenario attempt (kept on the unit, not on any objective). */
export async function recordScenarioAttempt(unitId: string, attempt: StudyAttempt): Promise<StudyUnitState> {
  const current = (await db.studyUnits.get(unitId)) ?? { id: unitId, courseId: unitId.split(":")[0], schemaVersion: SCHEMA_VERSION, scenarioAttempts: [] };
  const next: StudyUnitState = { ...current, scenarioAttempts: [...current.scenarioAttempts, attempt].slice(-30) };
  await db.studyUnits.put(next);
  return next;
}
