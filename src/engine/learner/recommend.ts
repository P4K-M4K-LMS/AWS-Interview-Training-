import type { Mission, MissionProgress, SkillId, SkillState, StudyObjectiveState } from "../../domain/types";
import { dueStudyReviews } from "../study/mastery";
import { MISSIONS, MISSION_BY_ID, RECOMMENDED_ORDER } from "../../content/missions";
import { computeStatus } from "../missions/engine";
import { dueForReview } from "./mastery";
import { SKILL_BY_ID } from "../../content/curriculum";

export interface Recommendation {
  kind: "resume" | "next-mission" | "retention" | "study-review" | "study-next" | "interview" | "done";
  title: string;
  reason: string;
  missionId?: string;
  skillId?: SkillId;
  path: string;
}

/** Optional Study input: objective states and, if known, the next course to continue. */
export interface StudyInput {
  states: Iterable<StudyObjectiveState>;
  next?: { courseId: string; title: string };
}

/**
 * Next-step recommendation based on demonstrated skills, prerequisites and
 * spaced-repetition due dates. Pure function so it can be tested.
 */
export function recommendNext(progress: Map<string, MissionProgress>, skills: Map<SkillId, SkillState>, now = new Date(), study?: StudyInput): Recommendation[] {
  const out: Recommendation[] = [];
  const inProgress = [...progress.values()].filter((p) => p.status === "in-progress").sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0];
  if (inProgress && MISSION_BY_ID.has(inProgress.missionId)) {
    const m = MISSION_BY_ID.get(inProgress.missionId)!;
    out.push({ kind: "resume", title: `Resume: ${m.title}`, reason: "You have an unfinished mission. Finishing it is the fastest way to earn mastery.", missionId: m.id, path: `/missions/${m.id}` });
  }
  const due = dueForReview(skills.values(), now);
  if (due.length) {
    const s = due[0];
    const retentionMission = MISSIONS.find((m) => m.skills.includes(s.skillId) && progress.get(m.id)?.status === "completed");
    out.push({
      kind: "retention",
      title: `Retention check: ${SKILL_BY_ID.get(s.skillId)?.name ?? s.skillId}`,
      reason: "Spaced repetition: recalling this now keeps the skill from fading.",
      skillId: s.skillId,
      missionId: retentionMission?.id,
      path: retentionMission ? `/missions/${retentionMission.id}?retention=1` : "/progress",
    });
  }
  const studyDue = study ? dueStudyReviews(study.states, now) : [];
  if (studyDue.length) {
    const s = studyDue[0];
    const [courseId, unitIndex, objectiveIndex] = s.objectiveId.split(":");
    out.push({
      kind: "study-review",
      title: `Study review due: ${studyDue.length} objective${studyDue.length === 1 ? "" : "s"}`,
      reason: "A missed check question comes back after 1, 7 and 21 days. Answer an unseen question to move it on.",
      path: `/study/${courseId}/${unitIndex}/${objectiveIndex}?review=1`,
    });
  }
  for (const id of RECOMMENDED_ORDER) {
    const m = MISSION_BY_ID.get(id)!;
    if (computeStatus(m, progress, skills) === "available" && !(inProgress && inProgress.missionId === id)) {
      out.push({ kind: "next-mission", title: `Next mission: ${m.title}`, reason: nextReason(m, progress), missionId: m.id, path: `/missions/${m.id}` });
      break;
    }
  }
  if (study?.next && !studyDue.length) {
    out.push({ kind: "study-next", title: `Continue studying: ${study.next.title}`, reason: "Pick up the next objective where you left off.", path: `/study/${study.next.courseId}` });
  }
  const completed = [...progress.values()].filter((p) => p.status === "completed").length;
  if (completed >= 1) {
    out.push({ kind: "interview", title: "Practise explaining your work", reason: "Interview: turn the mission you just finished into a clear technical explanation, or practise a Leadership Principle.", path: "/interview" });
  }
  if (!out.length) out.push({ kind: "done", title: "All current missions completed", reason: "More missions are planned (see STATUS). Use the labs freely or practise interviews.", path: "/interview" });
  return out;
}

function nextReason(m: Mission, progress: Map<string, MissionProgress>): string {
  if (m.prerequisites.length === 0) return "A good starting point: no prerequisites.";
  const done = m.prerequisites.filter((p) => progress.get(p)?.status === "completed").length;
  return `Unlocked by completing ${done}/${m.prerequisites.length} prerequisite mission(s). Builds on what you just practised.`;
}
