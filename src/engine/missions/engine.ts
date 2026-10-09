import { SCHEMA_VERSION, type CheckResult, type LeadershipPrincipleId, type Mission, type MissionProgress, type SkillId, type SkillState, type Story, type TerminalCheckContext, type TerminalMission, type InvestigationMission } from "../../domain/types";
import { db, logActivity, nowIso, uid } from "../../data/db";
import { SKILL_BY_ID } from "../../content/curriculum";
import { applyMissionCompletion, applyRetentionCheck, emptySkill } from "../learner/mastery";

/**
 * Mission engine: status computation (locked / available / in-progress /
 * completed), validation, hint accounting and completion bookkeeping.
 * Completion is only recorded when the mission's own checks pass.
 */

export function emptyProgress(missionId: string): MissionProgress {
  return {
    missionId,
    schemaVersion: SCHEMA_VERSION,
    status: "available",
    attempts: 0,
    hintsUsed: 0,
    maxHintLevel: 0,
    bestScore: 0,
    startedAt: null,
    completedAt: null,
    reflections: [],
  };
}

/**
 * A mission is available once its prerequisite missions are completed.
 * Skill mastery gates stage promotion, not mission access: a mission that
 * teaches a skill must not be locked behind that same skill.
 */
export function computeStatus(mission: Mission, progress: Map<string, MissionProgress>, _skills?: Map<SkillId, SkillState>): MissionProgress["status"] {
  const own = progress.get(mission.id);
  if (own?.status === "completed") return "completed";
  if (own?.status === "in-progress") return "in-progress";
  const prereqsDone = mission.prerequisites.every((p) => progress.get(p)?.status === "completed");
  return prereqsDone ? "available" : "locked";
}

export function runTerminalChecks(mission: TerminalMission | InvestigationMission, ctx: TerminalCheckContext): CheckResult[] {
  const checks = mission.kind === "terminal" ? mission.checks : mission.steps.flatMap((s) => s.checks);
  return checks.map((c) => {
    try {
      const r = c.test(ctx);
      if (typeof r === "boolean") return { id: c.id, label: c.label, passed: r };
      return { id: c.id, label: c.label, passed: r.passed, detail: r.detail };
    } catch (e) {
      return { id: c.id, label: c.label, passed: false, detail: `Check error: ${(e as Error).message}` };
    }
  });
}

export async function startMission(missionId: string) {
  const existing = (await db.missions.get(missionId)) ?? emptyProgress(missionId);
  if (existing.status === "completed") return existing;
  const next: MissionProgress = { ...existing, status: "in-progress", startedAt: existing.startedAt ?? nowIso() };
  await db.missions.put(next);
  if (!existing.startedAt) await logActivity({ type: "mission-start", missionId });
  return next;
}

export async function recordAttempt(missionId: string, score: number) {
  const p = (await db.missions.get(missionId)) ?? emptyProgress(missionId);
  const next = { ...p, status: p.status === "completed" ? p.status : ("in-progress" as const), attempts: p.attempts + 1, bestScore: Math.max(p.bestScore, score) };
  await db.missions.put(next);
  if (score < 1) await logActivity({ type: "mission-fail", missionId, detail: `score ${Math.round(score * 100)}%` });
  return next;
}

export async function revealHint(missionId: string, level: number) {
  const p = (await db.missions.get(missionId)) ?? emptyProgress(missionId);
  const next = { ...p, hintsUsed: p.hintsUsed + 1, maxHintLevel: Math.max(p.maxHintLevel, level) };
  await db.missions.put(next);
  await logActivity({ type: "hint", missionId, detail: `level ${level}` });
  return next;
}

export async function saveMissionState(missionId: string, savedState: unknown) {
  const p = (await db.missions.get(missionId)) ?? emptyProgress(missionId);
  await db.missions.put({ ...p, savedState, status: p.status === "available" ? "in-progress" : p.status, startedAt: p.startedAt ?? nowIso() });
}

/** Marks a mission complete and updates every skill it exercises. */
export async function completeMission(mission: Mission, minutes: number) {
  const at = nowIso();
  const p = (await db.missions.get(mission.id)) ?? emptyProgress(mission.id);
  const attempts = Math.max(1, p.attempts);
  const alreadyDone = p.status === "completed";
  const next: MissionProgress = { ...p, status: "completed", completedAt: p.completedAt ?? at, bestScore: 1, attempts, savedState: undefined };
  await db.missions.put(next);
  if (alreadyDone) return next;
  for (const skillId of mission.skills) {
    const state = (await db.skills.get(skillId)) ?? emptySkill(skillId);
    await db.skills.put(applyMissionCompletion(state, { missionId: mission.id, attempts, maxHintLevel: p.maxHintLevel, score: 1, at }));
  }
  await logActivity({ type: "mission-complete", missionId: mission.id, minutes });
  return next;
}

export async function resetMission(missionId: string) {
  await db.missions.delete(missionId);
}

export async function saveReflection(missionId: string, prompt: string, answer: string) {
  const p = (await db.missions.get(missionId)) ?? emptyProgress(missionId);
  await db.missions.put({ ...p, reflections: [...p.reflections.filter((r) => r.prompt !== prompt), { prompt, answer, at: nowIso() }] });
}

/** Leadership Principles a mission's story most plausibly illustrates; a suggestion the learner edits. */
export function suggestedPrinciples(mission: Mission): LeadershipPrincipleId[] {
  if (mission.kind === "incident") return ["ownership", "dive-deep"];
  if (mission.kind === "design") return ["think-big", "are-right-a-lot"];
  if (mission.kind === "lesson") return ["learn-and-be-curious"];
  switch (mission.trackId) {
    case "netsec":
      return ["dive-deep", "insist-on-the-highest-standards"];
    case "devops":
      return ["ownership", "insist-on-the-highest-standards"];
    case "distributed":
    case "serverless":
      return ["dive-deep", "are-right-a-lot"];
    default:
      return ["learn-and-be-curious", "dive-deep"];
  }
}

/**
 * Saves the reflection and keeps one draft story per mission in the Story
 * Bank: the reflection becomes the Action, the mission's summary the
 * Situation, its first objective the Task. The source is "technical
 * learning" and the evidence line says it was a simulation, so the draft
 * cannot be mistaken for work experience. Re-saving updates the same story
 * without touching fields the learner has edited by hand (result, lessons,
 * principles, title).
 */
export async function saveReflectionAndStory(mission: Mission, prompt: string, answer: string): Promise<Story> {
  await saveReflection(mission.id, prompt, answer);
  const existing = await db.stories.filter((s) => s.missionId === mission.id).first();
  const now = nowIso();
  const story: Story = existing
    ? { ...existing, action: answer, updatedAt: now }
    : {
        id: uid("story"),
        schemaVersion: SCHEMA_VERSION,
        title: `Practice: ${mission.title}`,
        source: "technical-learning",
        situation: `OpsForge practice mission (fictional Nimbus Freight scenario): ${mission.summary}`,
        task: mission.objectives[0] ?? "",
        action: answer,
        result: "",
        lessons: "",
        principles: suggestedPrinciples(mission),
        technicalSkills: mission.skills.map((s) => SKILL_BY_ID.get(s)?.name ?? s),
        evidence: "OpsForge simulation: practice, not workplace experience. Describe it as practice in interviews.",
        confidence: "high",
        practiceHistory: [],
        missionId: mission.id,
        createdAt: now,
        updatedAt: now,
      };
  await db.stories.put(story);
  if (!existing) await logActivity({ type: "story-saved", missionId: mission.id, detail: story.title });
  return story;
}

/* ------------------------------------------------------------------ */
/* Retention checks (spaced repetition)                                */
/* ------------------------------------------------------------------ */

/**
 * Starts a retention check on a completed mission: the saved workstation
 * state is discarded so the learner replays from a fresh environment, and
 * hints are disabled by the UI while `retention` is set.
 */
export async function startRetentionCheck(missionId: string) {
  const p = await db.missions.get(missionId);
  if (!p || p.status !== "completed") throw new Error("Retention checks are only available for completed missions.");
  const next: MissionProgress = { ...p, savedState: undefined, retention: { startedAt: nowIso(), attempts: 0 } };
  await db.missions.put(next);
  return next;
}

/**
 * Finishes a retention check. `passed` means every check was satisfied
 * without hints; otherwise the learner gave up and needs remediation.
 * Mastery moves by the spaced-repetition rule (+8 / -12) and the next review
 * date is rescheduled for every skill the mission exercises.
 */
export async function completeRetentionCheck(mission: Mission, passed: boolean, minutes: number) {
  const p = await db.missions.get(mission.id);
  if (!p?.retention) return p;
  const at = nowIso();
  for (const skillId of mission.skills) {
    const state = (await db.skills.get(skillId)) ?? emptySkill(skillId);
    await db.skills.put(applyRetentionCheck(state, passed, at, mission.id));
  }
  const next: MissionProgress = {
    ...p,
    retention: undefined,
    savedState: undefined,
    retentionHistory: [...(p.retentionHistory ?? []), { at, passed, minutes }],
  };
  await db.missions.put(next);
  await logActivity({ type: "retention-check", missionId: mission.id, minutes, detail: passed ? "recalled without hints" : "needs remediation" });
  return next;
}
