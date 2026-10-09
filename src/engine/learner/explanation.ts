import type { ExplanationLevel, GlossaryEntry, LearnerProfile, Mission, MissionPrimer, RoleId } from "../../domain/types";
import { PRIMERS } from "../../content/primers";

/**
 * Which way a mission lesson opens. The unnamed-role posting is the beginner
 * track, so its learners get the primer expanded; the SDE II posting assumes
 * professional experience, so the primer is collapsed one click away. An
 * explicit setting wins over the role default.
 */
export function defaultExplanationLevel(targetRoleId: RoleId | undefined): ExplanationLevel {
  return targetRoleId === "sde2-serverless" ? "standard" : "beginner";
}

export function effectiveExplanationLevel(profile: Pick<LearnerProfile, "targetRoleId" | "settings"> | null | undefined): ExplanationLevel {
  if (!profile) return "beginner";
  return profile.settings.explanationLevel ?? defaultExplanationLevel(profile.targetRoleId);
}

export function primerFor(mission: Pick<Mission, "id">): MissionPrimer | undefined {
  return PRIMERS[mission.id];
}

/** Glossary entries whose term appears in the primer, so the UI can point at them. */
export function primerTerms(mission: Pick<Mission, "id" | "glossary">): GlossaryEntry[] {
  const p = PRIMERS[mission.id];
  if (!p) return [];
  const text = `${p.plain} ${p.why} ${p.whyThisWay} ${p.firstStep}`.toLowerCase();
  return mission.glossary.filter((g) => {
    const term = g.term.toLowerCase();
    return [term, `${term}s`, term.replace(/y$/, "ies")].some((v) => text.includes(v));
  });
}
