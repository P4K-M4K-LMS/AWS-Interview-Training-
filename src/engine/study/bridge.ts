import { MISSION_LINKS } from "../../content/study/missionLinks";
import type { StudyObjectiveState } from "../../domain/types";
import { recordStudyAttempt } from "./store";

/**
 * The one bridge from missions into Study: completing a mission for the
 * first time credits every objective curated as taught by it (a correct
 * "mission" attempt, which the rubric takes to Guided at most). Nothing
 * flows the other way; Study never writes skill mastery.
 */
export async function creditLinkedObjectives(missionId: string, at: string): Promise<StudyObjectiveState[]> {
  const ids = MISSION_LINKS[missionId] ?? [];
  const out: StudyObjectiveState[] = [];
  for (const objectiveId of ids) {
    out.push(await recordStudyAttempt(objectiveId, { at, format: "mission", verdict: "correct", source: "mission", ref: missionId }));
  }
  return out;
}

/** Objective ids a mission credits (for the mission page's "also counts toward" note). */
export function objectivesCreditedBy(missionId: string): string[] {
  return MISSION_LINKS[missionId] ?? [];
}
