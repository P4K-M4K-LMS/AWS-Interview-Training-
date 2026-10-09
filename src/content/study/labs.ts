import type { StudyLink } from "../../domain/types";

/** Lab ids used by Study links, with their display names and routes. */
export const LAB_LABELS: Record<string, string> = {
  policy: "Authorization policy lab",
  network: "Network path lab",
  dr: "Recovery planner lab",
  alarms: "Metric alarm lab",
};

export function labExercisePath(link: Extract<StudyLink, { kind: "lab" }>, objectiveId: string): string {
  const q = new URLSearchParams();
  if (link.exerciseId) q.set("exercise", link.exerciseId);
  q.set("from", objectiveId);
  return `/labs/${link.labId}?${q.toString()}`;
}
