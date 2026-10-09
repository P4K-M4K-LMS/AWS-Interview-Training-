import type { Mission, MissionProgress, SkillId, SkillState, TargetRole } from "../../domain/types";
import { MISSIONS, RECOMMENDED_ORDER } from "../../content/missions";
import { SKILL_BY_ID } from "../../content/curriculum";
import { computeStatus } from "../missions/engine";

/**
 * Gap map from a target role's qualifications to demonstrated mastery.
 * Pure: the page renders it, tests check it. Mastery comes only from the
 * skill states (missions, independent solves, retention checks).
 */
export interface QualificationGap {
  qualification: TargetRole["qualifications"][number];
  skills: Array<{ id: SkillId; name: string; mastery: number }>;
  /** Missions that teach any of the mapped skills, with current status. */
  missions: Array<{ mission: Mission; status: MissionProgress["status"] }>;
  /** Average mastery over mapped skills; null when nothing is mapped. */
  pct: number | null;
}

export interface RoleGapMap {
  role: TargetRole;
  qualifications: QualificationGap[];
  /** Average over qualifications that have mapped skills. */
  trainablePct: number;
  /** The mapped qualification with the lowest mastery, if any. */
  weakest: QualificationGap | null;
  counts: Record<TargetRole["qualifications"][number]["coverage"], number>;
}

export function roleGapMap(role: TargetRole, skills: Map<SkillId, SkillState>, progress: Map<string, MissionProgress>): RoleGapMap {
  const qualifications = role.qualifications.map((q): QualificationGap => {
    const mapped = q.skills.map((id) => ({ id, name: SKILL_BY_ID.get(id)?.name ?? id, mastery: skills.get(id)?.mastery ?? 0 }));
    const missions = MISSIONS.filter((m) => m.skills.some((s) => q.skills.includes(s))).map((mission) => ({ mission, status: computeStatus(mission, progress, skills) }));
    const pct = mapped.length ? Math.round(mapped.reduce((a, s) => a + s.mastery, 0) / mapped.length) : null;
    return { qualification: q, skills: mapped, missions, pct };
  });
  const mapped = qualifications.filter((q) => q.pct !== null);
  const trainablePct = mapped.length ? Math.round(mapped.reduce((a, q) => a + (q.pct ?? 0), 0) / mapped.length) : 0;
  const weakest = mapped.length ? mapped.reduce((a, b) => ((b.pct ?? 0) < (a.pct ?? 0) ? b : a)) : null;
  const counts = { trainable: 0, partial: 0, planned: 0, "not-addressable": 0 };
  for (const q of role.qualifications) counts[q.coverage] += 1;
  return { role, qualifications, trainablePct, weakest, counts };
}

/**
 * The mission to do now for this role: walk the mapped qualifications from
 * weakest to strongest and return the first one that has a mission the
 * learner can start (or resume), earliest in the recommended order.
 */
export function nextMissionForGap(gap: RoleGapMap): { mission: Mission; gap: QualificationGap } | null {
  const order = new Map(RECOMMENDED_ORDER.map((id, i) => [id, i]));
  const mapped = gap.qualifications.filter((q) => q.pct !== null).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  for (const q of mapped) {
    const candidates = q.missions.filter((m) => m.status === "available" || m.status === "in-progress").sort((a, b) => (order.get(a.mission.id) ?? 999) - (order.get(b.mission.id) ?? 999));
    if (candidates.length) return { mission: candidates[0].mission, gap: q };
  }
  return null;
}
