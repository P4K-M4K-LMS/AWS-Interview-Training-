import Dexie, { type EntityTable } from "dexie";
import {
  SCHEMA_VERSION,
  type ActivityEvent,
  type ExportBundle,
  type InterviewSession,
  type LearnerProfile,
  type LearnerSettings,
  type MissionProgress,
  type SkillState,
  type Story,
  type StudyDay,
} from "../domain/types";

/**
 * IndexedDB persistence (via Dexie). Everything the learner produces lives
 * here, on this device only. Nothing is uploaded unless the learner enables
 * the optional coaching proxy and gives explicit consent.
 */
export class OpsForgeDB extends Dexie {
  profile!: EntityTable<LearnerProfile, "id">;
  skills!: EntityTable<SkillState, "skillId">;
  missions!: EntityTable<MissionProgress, "missionId">;
  stories!: EntityTable<Story, "id">;
  sessions!: EntityTable<InterviewSession, "id">;
  activity!: EntityTable<ActivityEvent, "id">;
  studyDays!: EntityTable<StudyDay, "date">;

  constructor(name = "opsforge") {
    super(name);
    this.version(1).stores({
      profile: "id",
      skills: "skillId, mastery, nextReviewAt",
      missions: "missionId, status, completedAt",
      stories: "id, title, updatedAt, *principles",
      sessions: "id, mode, startedAt, principleId, storyId",
      activity: "++id, at, type, missionId",
      studyDays: "date",
    });
  }
}

export const db = new OpsForgeDB();

export const DEFAULT_SETTINGS: LearnerSettings = {
  theme: "dark",
  voiceConsent: false,
  speakQuestions: true,
  keepRecordings: false,
  coachMode: "rules",
  coachProxyUrl: "",
  coachConsent: false,
  raceServiceUrl: "",
  dailyGoalMinutes: 30,
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

export async function getOrCreateProfile(database: OpsForgeDB = db): Promise<LearnerProfile> {
  const existing = await database.profile.get("me");
  if (existing) return existing;
  const profile: LearnerProfile = {
    id: "me",
    schemaVersion: SCHEMA_VERSION,
    displayName: "Trainee",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    stage: 1,
    onboardingComplete: false,
    assessment: {},
    settings: { ...DEFAULT_SETTINGS },
  };
  await database.profile.put(profile);
  return profile;
}

export async function updateProfile(
  patch: Partial<Omit<LearnerProfile, "id" | "schemaVersion">>,
  database: OpsForgeDB = db,
): Promise<LearnerProfile> {
  const current = await getOrCreateProfile(database);
  const next: LearnerProfile = {
    ...current,
    ...patch,
    settings: { ...current.settings, ...(patch.settings ?? {}) },
    updatedAt: nowIso(),
  };
  await database.profile.put(next);
  return next;
}

export async function logActivity(event: Omit<ActivityEvent, "id" | "at">, database: OpsForgeDB = db) {
  await database.activity.add({ ...event, at: nowIso() });
  if (event.minutes || event.type === "mission-complete" || event.type === "interview-session") {
    const date = localDate();
    const day = (await database.studyDays.get(date)) ?? {
      date,
      minutes: 0,
      missionsCompleted: 0,
      interviewSessions: 0,
    };
    day.minutes += event.minutes ?? 0;
    if (event.type === "mission-complete") day.missionsCompleted += 1;
    if (event.type === "interview-session") day.interviewSessions += 1;
    await database.studyDays.put(day);
  }
}

export async function exportAll(database: OpsForgeDB = db): Promise<ExportBundle> {
  const [profile, skills, missions, stories, sessions, activity] = await Promise.all([
    database.profile.get("me"),
    database.skills.toArray(),
    database.missions.toArray(),
    database.stories.toArray(),
    database.sessions.toArray(),
    database.activity.toArray(),
  ]);
  return {
    app: "opsforge",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    profile,
    skills,
    missions,
    stories,
    sessions,
    activity,
  };
}

export function validateBundle(data: unknown): ExportBundle {
  if (!data || typeof data !== "object") throw new Error("Import file is not a JSON object.");
  const b = data as Partial<ExportBundle>;
  if (b.app !== "opsforge") throw new Error("This file was not exported by OpsForge.");
  if (b.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version ${String(b.schemaVersion)} (expected ${SCHEMA_VERSION}).`);
  }
  return b as ExportBundle;
}

export async function importAll(bundle: ExportBundle, database: OpsForgeDB = db, mode: "merge" | "replace" = "merge") {
  await database.transaction(
    "rw",
    [database.profile, database.skills, database.missions, database.stories, database.sessions, database.activity],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          database.skills.clear(),
          database.missions.clear(),
          database.stories.clear(),
          database.sessions.clear(),
          database.activity.clear(),
        ]);
      }
      if (bundle.profile) await database.profile.put(bundle.profile);
      if (bundle.skills) await database.skills.bulkPut(bundle.skills);
      if (bundle.missions) await database.missions.bulkPut(bundle.missions);
      if (bundle.stories) await database.stories.bulkPut(bundle.stories);
      if (bundle.sessions) await database.sessions.bulkPut(bundle.sessions);
      if (bundle.activity) {
        await database.activity.bulkPut(bundle.activity.map((a) => ({ ...a, id: undefined })));
      }
    },
  );
}

/** Deletes every record. Used by Settings > Reset all progress. */
export async function resetAll(database: OpsForgeDB = db) {
  await database.transaction(
    "rw",
    [
      database.profile,
      database.skills,
      database.missions,
      database.stories,
      database.sessions,
      database.activity,
      database.studyDays,
    ],
    async () => {
      await Promise.all([
        database.profile.clear(),
        database.skills.clear(),
        database.missions.clear(),
        database.stories.clear(),
        database.sessions.clear(),
        database.activity.clear(),
        database.studyDays.clear(),
      ]);
    },
  );
}
