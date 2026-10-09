import { SCHEMA_VERSION, type CareerStage, type SkillEvidence, type SkillId, type SkillState } from "../../domain/types";
import { ALL_SKILLS, SKILL_BY_ID, STAGES } from "../../content/curriculum";

/**
 * Learner model: mastery is earned only from demonstrated work.
 *
 *  - completing a mission grants a base gain reduced by hint usage and attempts
 *  - an independent solve (no hints, <= 2 attempts) grants a bonus
 *  - retention checks (spaced repetition) confirm mastery over time
 *  - time spent never adds mastery
 */

export function emptySkill(skillId: SkillId): SkillState {
  return {
    skillId,
    schemaVersion: SCHEMA_VERSION,
    mastery: 0,
    attempts: 0,
    hintsUsed: 0,
    independentSolves: 0,
    errorPatterns: {},
    lastPracticedAt: null,
    nextReviewAt: null,
    reviewIntervalDays: 1,
    evidence: [],
  };
}

export interface CompletionSignal {
  missionId: string;
  attempts: number;
  maxHintLevel: number; // 0..4
  /** Fraction of checks passed on completion (1 = all). */
  score: number;
  at: string;
  /** True when the learner solved a transfer variant they had not seen before. */
  transfer?: boolean;
}

export function applyMissionCompletion(state: SkillState, s: CompletionSignal): SkillState {
  const independent = s.maxHintLevel === 0 && s.attempts <= 2;
  // Base gain shrinks with hints (each level -15%) and extra attempts (-5% each beyond 2).
  const hintPenalty = Math.min(0.6, s.maxHintLevel * 0.15);
  const attemptPenalty = Math.min(0.3, Math.max(0, s.attempts - 2) * 0.05);
  const base = 35 * s.score * (1 - hintPenalty - attemptPenalty);
  const bonus = independent ? 10 : 0;
  const transferBonus = s.transfer ? 10 : 0;
  // Diminishing returns as mastery rises.
  const headroom = (100 - state.mastery) / 100;
  const delta = Math.round((base + bonus + transferBonus) * (0.4 + 0.6 * headroom));
  const mastery = clamp(state.mastery + delta);
  const next = new Date(s.at);
  const intervalDays = independent ? Math.min(30, state.reviewIntervalDays * 2) : 1;
  next.setDate(next.getDate() + intervalDays);
  return {
    ...state,
    mastery,
    attempts: state.attempts + s.attempts,
    hintsUsed: state.hintsUsed + s.maxHintLevel,
    independentSolves: state.independentSolves + (independent ? 1 : 0),
    lastPracticedAt: s.at,
    nextReviewAt: next.toISOString(),
    reviewIntervalDays: intervalDays,
    evidence: [
      ...state.evidence,
      { at: s.at, missionId: s.missionId, kind: (independent ? "independent-solve" : "mission-complete") as SkillEvidence["kind"], delta, note: independent ? "solved without hints" : `hint level ${s.maxHintLevel}, ${s.attempts} attempts` },
      ...(s.transfer ? [{ at: s.at, missionId: s.missionId, kind: "transfer" as const, delta: transferBonus }] : []),
    ].slice(-50),
  };
}

export function applyRetentionCheck(state: SkillState, passed: boolean, at: string, missionId = "retention"): SkillState {
  const delta = passed ? 8 : -12;
  const intervalDays = passed ? Math.min(60, state.reviewIntervalDays * 2) : 1;
  const next = new Date(at);
  next.setDate(next.getDate() + intervalDays);
  return {
    ...state,
    mastery: clamp(state.mastery + delta),
    lastPracticedAt: at,
    nextReviewAt: next.toISOString(),
    reviewIntervalDays: intervalDays,
    evidence: [...state.evidence, { at, missionId, kind: "retention-check" as const, delta, note: passed ? "recalled correctly" : "needs remediation" }].slice(-50),
  };
}

export function recordError(state: SkillState, pattern: string): SkillState {
  return { ...state, errorPatterns: { ...state.errorPatterns, [pattern]: (state.errorPatterns[pattern] ?? 0) + 1 } };
}

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function masteryLabel(m: number): "not started" | "learning" | "practicing" | "proficient" | "mastered" {
  if (m <= 0) return "not started";
  if (m < 30) return "learning";
  if (m < 60) return "practicing";
  if (m < 85) return "proficient";
  return "mastered";
}

/** Skills whose prerequisites are all at or above the threshold. */
export function unlockedSkills(skills: Map<SkillId, SkillState>, threshold = 40): Set<SkillId> {
  const out = new Set<SkillId>();
  for (const s of ALL_SKILLS) {
    if (s.prerequisites.every((p) => (skills.get(p)?.mastery ?? 0) >= threshold)) out.add(s.id);
  }
  return out;
}

export function eligibleStage(skills: Map<SkillId, SkillState>): CareerStage {
  let stage: CareerStage = 1;
  for (const info of STAGES) {
    if (info.stage === 1) continue;
    const ok = info.requiredSkills.every((id) => (skills.get(id)?.mastery ?? 0) >= info.requiredMastery);
    if (ok) stage = info.stage;
    else break;
  }
  return stage;
}

export function stageProgress(stage: CareerStage, skills: Map<SkillId, SkillState>) {
  const next = STAGES.find((s) => s.stage === stage + 1);
  if (!next) return { next: null, items: [], pct: 100 };
  const items = next.requiredSkills.map((id) => ({
    skill: SKILL_BY_ID.get(id)!,
    mastery: skills.get(id)?.mastery ?? 0,
    required: next.requiredMastery,
    met: (skills.get(id)?.mastery ?? 0) >= next.requiredMastery,
  }));
  const pct = Math.round((items.filter((i) => i.met).length / Math.max(1, items.length)) * 100);
  return { next, items, pct };
}

/** Skills due for a retention check (nextReviewAt in the past). */
export function dueForReview(skills: Iterable<SkillState>, now = new Date()): SkillState[] {
  return [...skills].filter((s) => s.mastery > 0 && s.nextReviewAt && new Date(s.nextReviewAt) <= now).sort((a, b) => a.nextReviewAt!.localeCompare(b.nextReviewAt!));
}
