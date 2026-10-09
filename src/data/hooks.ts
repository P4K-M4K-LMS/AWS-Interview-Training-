import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { db, getOrCreateProfile } from "./db";
import type { LearnerProfile, MissionProgress, SkillId, SkillState } from "../domain/types";
import { MISSIONS } from "../content/missions";
import { computeStatus } from "../engine/missions/engine";

/** Live learner profile (creates one on first use). */
export function useProfile(): LearnerProfile | undefined {
  const profile = useLiveQuery(() => db.profile.get("me"), []);
  useEffect(() => {
    if (profile === null || profile === undefined) void getOrCreateProfile();
  }, [profile]);
  return profile ?? undefined;
}

export function useSkills(): Map<SkillId, SkillState> {
  const rows = useLiveQuery(() => db.skills.toArray(), []) ?? [];
  return useMemo(() => new Map(rows.map((r) => [r.skillId, r])), [rows]);
}

export function useMissionProgress(): Map<string, MissionProgress> {
  const rows = useLiveQuery(() => db.missions.toArray(), []) ?? [];
  return useMemo(() => new Map(rows.map((r) => [r.missionId, r])), [rows]);
}

export function useMissionStatuses() {
  const progress = useMissionProgress();
  const skills = useSkills();
  return useMemo(() => {
    const statuses = new Map<string, MissionProgress["status"]>();
    for (const m of MISSIONS) statuses.set(m.id, computeStatus(m, progress, skills));
    return { statuses, progress, skills };
  }, [progress, skills]);
}

export function useStories() {
  return useLiveQuery(() => db.stories.orderBy("updatedAt").reverse().toArray(), []) ?? [];
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.orderBy("startedAt").reverse().toArray(), []) ?? [];
}

export function useActivity(limit = 50) {
  return useLiveQuery(() => db.activity.orderBy("at").reverse().limit(limit).toArray(), [limit]) ?? [];
}

export function useStudyDays() {
  return useLiveQuery(() => db.studyDays.toArray(), []) ?? [];
}
