/**
 * OpsForge domain model.
 *
 * Every persisted record carries `schemaVersion` so future migrations can be
 * applied in `src/data/db.ts`. Curriculum, missions and Leadership Principle
 * content are static TypeScript (never stored); learner state, stories and
 * interview sessions are stored in IndexedDB.
 */

import type { StudyField, StudyLevel } from "../content/study/paths.ts";
export type { StudyField, StudyLevel };

export const SCHEMA_VERSION = 2 as const;
/** Export bundles OpsForge can still import. v1 had no Study tables. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1, 2];

/* ------------------------------------------------------------------ */
/* Curriculum                                                          */
/* ------------------------------------------------------------------ */

export type TrackId =
  | "linux"
  | "python"
  | "algorithms"
  | "netsec"
  | "devops"
  | "distributed"
  | "serverless";

/** Six fictional career stages. These are game levels, not credentials. */
export type CareerStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface StageInfo {
  stage: CareerStage;
  title: string;
  focus: string;
  /** Mastery (0-100) across the stage's required skills needed to be promoted. */
  requiredMastery: number;
  requiredSkills: SkillId[];
}

export type SkillId = `${TrackId}.${string}`;

export interface Skill {
  id: SkillId;
  trackId: TrackId;
  name: string;
  description: string;
  prerequisites: SkillId[];
}

export interface Track {
  id: TrackId;
  name: string;
  shortName: string;
  summary: string;
  skills: Skill[];
}

/* ------------------------------------------------------------------ */
/* Target roles (job postings the learner trains toward)               */
/* ------------------------------------------------------------------ */

export type RoleId = "ops-automation" | "sde2-serverless";

/**
 * How far OpsForge can take a learner toward one qualification.
 * trainable: skills and missions exist; partial: some skills exist, gaps are
 * named; planned: nothing built yet but it is buildable; not-addressable: a
 * credential, tenure or clearance no training app can supply.
 */
export type QualificationCoverage = "trainable" | "partial" | "planned" | "not-addressable";

export interface RoleQualification {
  id: string;
  kind: "basic" | "preferred";
  /** The posting's wording, verbatim. */
  text: string;
  coverage: QualificationCoverage;
  /** Skills whose mastery measures progress toward this qualification (empty when not trainable). */
  skills: SkillId[];
  /** Honest note on what is and is not covered. */
  note: string;
}

export interface TargetRole {
  id: RoleId;
  /** Posting title, or an honest placeholder when the posting did not include one. */
  title: string;
  team?: string;
  location?: string;
  /** Date shown on the posting, as given. */
  updated?: string;
  /** Where the text came from, so nothing here is presented as more official than it is. */
  source: string;
  /** Verbatim excerpt of the description, if any was provided. */
  descriptionExcerpt?: string;
  qualifications: RoleQualification[];
  /** One line per track: which qualification it supports for this role. */
  trackAlignment: Record<TrackId, string>;
  /** Interview themes to expect for this role, drawn from its qualifications. */
  interviewFocus: string[];
  disclaimer: string;
}

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export type MissionKind = "terminal" | "python" | "go" | "bigo" | "investigation" | "incident" | "design" | "lesson";

/** Languages with an in-browser runtime. */
export type CodeLanguage = "python" | "go";

export interface LessonBlock {
  /** Short heading shown in the lesson pane. */
  title: string;
  /** Markdown-ish text: paragraphs separated by blank lines; `code` spans and ``` blocks supported. */
  body: string;
}

/**
 * Beginner primer shown before a mission's lesson: what the thing is in plain
 * words, why it matters in real work, why this approach rather than the obvious
 * alternative, and why the first step is the first step (shown by the hints).
 */
export interface MissionPrimer {
  /** No code spans: everyday words and, where it helps, an analogy. */
  plain: string;
  why: string;
  whyThisWay: string;
  firstStep: string;
}

/** How mission lessons open: primer expanded (beginner) or collapsed (standard). */
export type ExplanationLevel = "beginner" | "standard";
export type StudyStyle = "doing" | "reading" | "mixed";

export interface GlossaryEntry {
  term: string;
  definition: string;
}

/** Tiered hint: index 0 is the smallest nudge, last is a guided example. */
export interface Hint {
  level: 1 | 2 | 3 | 4;
  title: string;
  body: string;
}

export interface MissionBase {
  id: string;
  kind: MissionKind;
  trackId: TrackId;
  stage: CareerStage;
  title: string;
  /** One-line summary shown in lists. */
  summary: string;
  /** In-world briefing from the fictional company. Clearly fictional. */
  briefing: string;
  objectives: string[];
  skills: SkillId[];
  prerequisites: string[];
  estimatedMinutes: number;
  lesson: LessonBlock[];
  glossary: GlossaryEntry[];
  hints: Hint[];
  /** Interview-style reflection prompts shown after completion (Part 13). */
  reflectionPrompts: string[];
  /** Real-world transfer note: how the fictional task maps to real work. */
  transferNote: string;
}

/* --- Terminal missions ------------------------------------------------ */

export interface FsFileSpec {
  type: "file";
  content: string;
  mode?: number; // e.g. 0o644
  owner?: string;
  group?: string;
  /** Reported size in bytes when larger than the content (big logs, dumps); dropped once the file is rewritten. */
  size?: number;
}
export interface FsDirSpec {
  type: "dir";
  mode?: number;
  owner?: string;
  group?: string;
}
export type FsSpec = Record<string, FsFileSpec | FsDirSpec>;

export interface SimProcessSpec {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
  /** Service name if this process belongs to a managed service. */
  service?: string;
}

export interface SimServiceSpec {
  name: string;
  status: "running" | "stopped" | "failed";
  description: string;
  /** Message shown by `systemctl status` when failed. */
  failureReason?: string;
  /** Path to a config file whose problems must be fixed before the service can start. */
  configPath?: string;
  /** Validation run before the service starts; returns an error message or null. */
  configCheck?: (content: string) => string | null;
  /** User the service runs as; the simulator checks it can read configPath and write requiredWritable. */
  runAs?: string;
  requiredWritable?: string[];
}

/** What a mission-specific program can see and do inside the simulator. */
export interface ProgramHost {
  readFile: (path: string) => string | null;
  writeFile: (path: string, content: string, asRoot?: boolean) => { ok: boolean; error?: string };
  exists: (path: string) => boolean;
  mode: (path: string) => number | null;
  env: Record<string, string>;
  cwd: string;
  user: string;
  history: string[];
}

export interface ProgramResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** A simulated executable shipped with a mission (e.g. `ci`, `deployctl`). */
export interface SimProgram {
  summary: string;
  usage: string;
  run: (args: string[], host: ProgramHost) => ProgramResult;
}

export interface TerminalWorld {
  hostname: string;
  user: string;
  cwd: string;
  fs: FsSpec;
  processes?: SimProcessSpec[];
  services?: SimServiceSpec[];
  env?: Record<string, string>;
  /** Mission-specific programs, keyed by command name. */
  programs?: Record<string, SimProgram>;
  /** Simulated network for ping/dig/curl/ss: hosts, HTTP responses, listening sockets, established connections. */
  network?: {
    hosts?: Record<string, { ip: string; reachable: boolean; latencyMs?: number }>;
    http?: Record<string, { status: number; body: string; headers?: Record<string, string> }>;
    listening?: Array<{ proto: "tcp" | "udp"; port: number; process: string; address?: string }>;
    connections?: Array<{ proto: "tcp" | "udp"; local: string; peer: string; process: string; pid?: number }>;
  };
}

/** Result of a terminal validation rule. */
export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface TerminalMission extends MissionBase {
  kind: "terminal";
  world: TerminalWorld;
  /**
   * Validation runs against the live simulator state and command history.
   * Rules are pure functions (content lives in code, not the database).
   */
  checks: Array<{
    id: string;
    label: string;
    test: (ctx: TerminalCheckContext) => boolean | { passed: boolean; detail?: string };
  }>;
  /** Documented subset of commands the learner is expected to use. */
  commandsIntroduced: string[];
}

export interface TerminalCheckContext {
  /** Read a file; returns null if missing. */
  readFile: (path: string) => string | null;
  exists: (path: string) => boolean;
  isDir: (path: string) => boolean;
  mode: (path: string) => number | null;
  owner: (path: string) => string | null;
  /** Reported size in bytes (virtual size for abbreviated large files); null if missing. */
  size: (path: string) => number | null;
  history: string[];
  /** Full output text of every command executed so far. */
  outputs: Array<{ command: string; stdout: string; stderr: string; exitCode: number }>;
  services: Record<string, SimServiceSpec["status"]>;
  processes: SimProcessSpec[];
  cwd: string;
}

/* --- Python missions -------------------------------------------------- */

export interface PythonTestCase {
  id: string;
  label: string;
  /**
   * Source evaluated after the learner's program in the same interpreter
   * namespace; must raise/panic on failure (Python: assert; Go: panic).
   */
  code: string;
  /** Optional stdin to feed `input()`. */
  stdin?: string;
}

/**
 * A code mission: the learner edits a program in the given language and the
 * mission's test snippets run in the same interpreter namespace afterwards.
 * `kind` doubles as the language ("python" or "go").
 */
export interface CodeMission extends MissionBase {
  kind: CodeLanguage;
  starterCode: string;
  /** Known-good solution used by the automated mission verification tests. */
  referenceSolution: string;
  tests: PythonTestCase[];
  /** Common error -> explanation mapping shown next to tracebacks. */
  errorHelp?: Array<{ match: RegExp; explanation: string }>;
}

/** Backwards-compatible alias. */
export type PythonMission = CodeMission;

/* --- Big O missions --------------------------------------------------- */

export type ComplexityClass =
  | "O(1)"
  | "O(log n)"
  | "O(n)"
  | "O(n log n)"
  | "O(n^2)"
  | "O(2^n)";

export interface BigOTask {
  id: string;
  label: string;
  /** Either a prediction question or an experiment the learner must run. */
  type: "predict" | "experiment" | "compare";
  prompt: string;
  /** For predict/compare: the algorithm key(s) in the visualizer. */
  algorithms: string[];
  /** Expected answer for predict tasks. */
  expected?: ComplexityClass;
  /** Experiment tasks require the learner to run with n >= this and observe counts. */
  minInputSize?: number;
  /** Explanation shown after answering. */
  explanation: string;
}

export interface BigOMission extends MissionBase {
  kind: "bigo";
  tasks: BigOTask[];
}

/* --- Investigation missions (security / automation / incident) ------- */

export interface InvestigationStep {
  id: string;
  prompt: string;
  /** A terminal world is shared across the mission; each step may add checks. */
  checks: TerminalMission["checks"];
  /** Optional structured question answered after the hands-on part. */
  question?: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface InvestigationMission extends MissionBase {
  kind: "investigation";
  world: TerminalWorld;
  steps: InvestigationStep[];
  commandsIntroduced: string[];
}

/* --- Incident missions (monitoring + incident console) --------------- */

export interface SimConfig {
  requestsPerSec: number;
  workers: number;
  cacheHitRate: number;
  dbDegraded: boolean;
  deployInProgress: boolean;
  queueConsumers: number;
  /** A long-running statement holds a lock the replica's apply thread needs, so replication stalls. */
  replicaBlocked?: boolean;
  /** Map reads pinned to the primary (mitigates stale reads at the cost of primary load). */
  readsFromPrimary?: boolean;
  /** Present when the scenario runs the serverless (function-based) part of the platform. */
  serverless?: ServerlessConfig;
}

/**
 * Simulated serverless platform: a synchronous function behind the API and
 * an asynchronous function fed by the job queue. Generic concepts only
 * (concurrency limits, cold starts, retries, dead-letter queues, idempotency);
 * this is not an emulation of any vendor's service.
 */
export interface ServerlessConfig {
  /** Average handler duration of the synchronous function, ms. */
  durationMs: number;
  /** Maximum concurrent executions allowed for the synchronous function. */
  reservedConcurrency: number;
  /** Pre-warmed execution environments (no cold start for these). */
  provisionedConcurrency: number;
  /** Share of queue messages the async function can never process (malformed payloads). */
  poisonRate: number;
  /** Attempts before a message is moved to the dead-letter queue (when enabled). */
  maxReceiveCount: number;
  dlqEnabled: boolean;
  /** Share of async invocations that time out (slow downstream) and get retried by the platform. */
  timeoutRate: number;
  /** Platform retries for a failed asynchronous invocation. */
  asyncRetries: number;
  /** The async handler tolerates being run more than once for the same event. */
  handlerIdempotent: boolean;
}

export type SimActionType =
  | "scale-workers"
  | "set-cache-hit"
  | "restart-db"
  | "set-consumers"
  | "rollback-deploy"
  | "set-traffic"
  | "kill-blocking-query"
  | "route-reads-primary"
  | "route-reads-replica"
  | "set-reserved-concurrency"
  | "set-provisioned-concurrency"
  | "enable-dlq"
  | "set-async-retries"
  | "make-handler-idempotent"
  | "raise-function-timeout";

/** Time-accumulated parts of the simulation that a remediation check may need. */
export interface SimSnapshot {
  queueDepth: number;
  /** Seconds the read replica is behind the primary. */
  replicaLag: number;
  /** Seconds of committed writes lost by promoting a lagging replica (0 when none). */
  lostWritesSec: number;
  /** Serverless accumulations (0 when the scenario has no serverless part). */
  warmEnvironments: number;
  poisonBacklog: number;
  dlqDepth: number;
  duplicateSideEffects: number;
  lostInvocations: number;
}

export interface IncidentTicket {
  title: string;
  reporter: string;
  description: string;
  symptoms: string[];
  impact: string;
}

export interface IncidentScenario {
  /** The broken state the incident opens in. */
  initialConfig: SimConfig;
  /** Queue depth at the start (the queue accumulates over time). */
  initialQueueDepth: number;
  /** Replica lag in seconds at the start (grows while replication is blocked). */
  initialReplicaLag?: number;
  /** Serverless accumulations at the start. */
  initialServerless?: Partial<Pick<SimSnapshot, "warmEnvironments" | "poisonBacklog" | "dlqDepth" | "duplicateSideEffects" | "lostInvocations">>;
  ticket: IncidentTicket;
  /** Runbook actions available to the responder. */
  allowedActions: SimActionType[];
  rootCause: { prompt: string; options: string[]; correctIndex: number; explanation: string };
  /** A remediation is valid when the configuration fixes the cause, not just the symptom. */
  remediationCheck: (config: SimConfig, sim: SimSnapshot) => { passed: boolean; detail?: string };
  /** Consecutive healthy ticks required to declare recovery. */
  verifyTicks: number;
  postmortemPrompt: string;
}

export interface IncidentMission extends MissionBase {
  kind: "incident";
  scenario: IncidentScenario;
}

/* --- Design exercises (requirements in, justified design out) ---------- */

export interface DesignOption {
  id: string;
  name: string;
  description: string;
  /** Monthly cost in fictional currency units. */
  cost: number;
  /** Sustained capacity in requests or events per second, when the option sits on the ingest path. */
  capacity?: number;
  /** Added latency on the read path, ms. */
  latencyMs?: number;
  /** True when losing this one component stops the path it is on. */
  spof?: boolean;
  /** True when the option keeps data safely across a downstream outage. */
  durable?: boolean;
  consistency?: "strong" | "eventual";
}

export interface DesignSlot {
  id: string;
  label: string;
  prompt: string;
  /** Which requirement paths this slot belongs to. */
  paths: Array<"write" | "read">;
  options: DesignOption[];
}

export interface DesignQuantity {
  id: string;
  label: string;
  prompt: string;
  unit: string;
  /** Accepted range (inclusive). */
  min: number;
  max: number;
  explanation: string;
}

export interface DesignDrill {
  id: string;
  prompt: string;
  options: string[];
  /** The correct option depends on the design: a pure function of the chosen option ids per slot. */
  answerFor: (choices: Record<string, string>) => number;
  explanation: string;
}

export interface DesignRequirements {
  functional: string[];
  /** Peak load the write path must sustain, events per second. */
  peakIngestPerSec: number;
  /** p95 read latency budget, ms (sum of read-path latencies). */
  maxReadLatencyMs: number;
  /** Monthly budget. */
  budget: number;
  /** No single point of failure allowed on these paths. */
  noSpofOn: Array<"write" | "read">;
  /** Data on the write path must survive a downstream outage (a durable buffer or equivalent). */
  durableWrites: boolean;
  /** Unit shown for the peak load, default "events/s". */
  unit?: string;
  /** Label for the durability check, default "Events survive a storage outage (durable buffer)". */
  durableLabel?: string;
  /** When set, every read-path option that declares a consistency model must match it. */
  consistency?: "strong" | "eventual";
  /** Terms a justification must touch (at least `justificationMinTerms` of them). */
  justificationTerms: string[];
  justificationMinTerms: number;
  justificationMinChars: number;
}

export interface DesignMission extends MissionBase {
  kind: "design";
  requirements: DesignRequirements;
  slots: DesignSlot[];
  quantities: DesignQuantity[];
  drills: DesignDrill[];
  /** A design that satisfies every check; used by tests and the level-4 hint. */
  referenceDesign: { choices: Record<string, string>; quantities: Record<string, number>; justification: string };
}

/* --- Lesson missions (knowledge with a check quiz; for process topics) --- */

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonMission extends MissionBase {
  kind: "lesson";
  /** Short scenario the quiz questions refer to. */
  scenario: string;
  quiz: QuizQuestion[];
  /** How this topic comes up in interviews and how to answer. */
  interviewCue: string;
}

export type Mission = TerminalMission | CodeMission | BigOMission | InvestigationMission | IncidentMission | DesignMission | LessonMission;

/* ------------------------------------------------------------------ */
/* Learner state (persisted)                                           */
/* ------------------------------------------------------------------ */

export type Theme = "dark" | "light";
export type CoachMode = "rules" | "claude";

export interface LearnerSettings {
  theme: Theme;
  /** Explicit consent to use the microphone and keep transcripts locally. */
  voiceConsent: boolean;
  /** Whether the virtual interviewer speaks questions aloud. */
  speakQuestions: boolean;
  /** Keep audio recordings (blobs) locally; transcripts are always text. */
  keepRecordings: boolean;
  coachMode: CoachMode;
  /** Base URL of the optional coaching proxy, e.g. http://localhost:8787 */
  coachProxyUrl: string;
  /** Explicit consent to send transcripts to the coaching proxy. */
  coachConsent: boolean;
  /** Base URL of the optional local race-detector service, e.g. http://localhost:8788. Empty = off. */
  raceServiceUrl?: string;
  dailyGoalMinutes: number;
  /** Unset = follow the target role (the unnamed-role track is beginner-first). */
  explanationLevel?: ExplanationLevel;
  /** Study: order objectives by learning style. Unset = mixed (catalog order). Never hides anything. */
  studyStyle?: StudyStyle;
  /** Health disclaimer versions accepted, by field ("nursing", "pt"). Unset = never accepted. */
  studyAcknowledgements?: Partial<Record<"nursing" | "pt", number>>;
}

export interface LearnerProfile {
  id: "me";
  schemaVersion: typeof SCHEMA_VERSION;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  stage: CareerStage;
  onboardingComplete: boolean;
  /** Results of the initial beginner assessment, by skill. */
  assessment: Partial<Record<SkillId, number>>;
  settings: LearnerSettings;
  /** Posting the learner trains toward; absent on profiles created before roles existed (treated as the default role). */
  targetRoleId?: RoleId;
}

export interface SkillEvidence {
  at: string;
  missionId: string;
  kind: "mission-complete" | "independent-solve" | "retention-check" | "assessment" | "transfer";
  delta: number;
  note?: string;
}

export interface SkillState {
  skillId: SkillId;
  schemaVersion: typeof SCHEMA_VERSION;
  /** 0-100 demonstrated mastery. */
  mastery: number;
  attempts: number;
  hintsUsed: number;
  independentSolves: number;
  errorPatterns: Record<string, number>;
  lastPracticedAt: string | null;
  /** Spaced repetition: when a retention check is due. */
  nextReviewAt: string | null;
  /** Spaced repetition interval in days. */
  reviewIntervalDays: number;
  evidence: SkillEvidence[];
}

export type MissionStatus = "locked" | "available" | "in-progress" | "completed";

export interface MissionProgress {
  missionId: string;
  schemaVersion: typeof SCHEMA_VERSION;
  status: MissionStatus;
  attempts: number;
  hintsUsed: number;
  /** Highest hint level revealed in the completing attempt (0 = none). */
  maxHintLevel: number;
  bestScore: number;
  startedAt: string | null;
  completedAt: string | null;
  /** Serialized workstation state so a mission can be resumed. */
  savedState?: unknown;
  /**
   * Active spaced-repetition retention check: the learner replays a completed
   * mission from a fresh environment with hints disabled. Cleared on finish.
   */
  retention?: { startedAt: string; attempts: number };
  /** History of retention checks on this mission. */
  retentionHistory?: Array<{ at: string; passed: boolean; minutes: number }>;
  /** Reflection answers written after completion (Part 13). */
  reflections: Array<{ prompt: string; answer: string; at: string }>;
  /**
   * Times the learner chose "Redo" after completing. A redo reopens the
   * mission as in-progress with a fresh workstation; completedAt stays set so
   * prerequisites stay satisfied and mastery is not awarded twice.
   */
  redoCount?: number;
}

export interface ActivityEvent {
  id?: number;
  at: string;
  type:
    | "mission-start"
    | "mission-complete"
    | "mission-fail"
    | "hint"
    | "python-run"
    | "terminal-command"
    | "bigo-experiment"
    | "interview-session"
    | "story-saved"
    | "retention-check"
    | "stage-promotion"
    | "assessment";
  missionId?: string;
  detail?: string;
  minutes?: number;
}

export interface StudyDay {
  /** YYYY-MM-DD local date */
  date: string;
  minutes: number;
  missionsCompleted: number;
  interviewSessions: number;
}

/* ------------------------------------------------------------------ */
/* Interview Command Center (persisted)                                */
/* ------------------------------------------------------------------ */

export type LeadershipPrincipleId =
  | "customer-obsession"
  | "ownership"
  | "invent-and-simplify"
  | "are-right-a-lot"
  | "learn-and-be-curious"
  | "hire-and-develop-the-best"
  | "insist-on-the-highest-standards"
  | "think-big"
  | "bias-for-action"
  | "frugality"
  | "earn-trust"
  | "dive-deep"
  | "have-backbone-disagree-and-commit"
  | "deliver-results"
  | "strive-to-be-earths-best-employer"
  | "success-and-scale-bring-broad-responsibility";

export type StorySource =
  | "employment"
  | "school"
  | "volunteer"
  | "personal-project"
  | "customer-service"
  | "technical-learning"
  | "teamwork"
  | "troubleshooting"
  | "mistake"
  | "process-improvement";

export type FactualConfidence = "high" | "medium" | "low";

export interface Story {
  id: string;
  schemaVersion: typeof SCHEMA_VERSION;
  title: string;
  source: StorySource;
  situation: string;
  task: string;
  action: string;
  result: string;
  lessons: string;
  principles: LeadershipPrincipleId[];
  technicalSkills: string[];
  /** Where the facts can be checked (dates, documents, people, repos). */
  evidence: string;
  confidence: FactualConfidence;
  /** Interview session ids where this story was used. */
  practiceHistory: string[];
  /** Set when the story is a draft created from a mission reflection (practice, never work experience). */
  missionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type InterviewMode = "guided" | "practice" | "realistic" | "dive-deeper";
export type InputMode = "voice" | "text";

export type GapType =
  | "ownership"
  | "technical-detail"
  | "decision-making"
  | "results"
  | "learning"
  | "principle"
  | "situation"
  | "task";

export interface DetectedGap {
  type: GapType;
  severity: 1 | 2 | 3;
  /** Evidence from the answer (quoted phrases) that triggered the gap. */
  evidence: string[];
  resolved: boolean;
}

export interface StarEvidence {
  situation: string[];
  task: string[];
  action: string[];
  result: string[];
  learning: string[];
}

export interface InterviewTurn {
  id: string;
  at: string;
  role: "interviewer" | "learner" | "coach";
  text: string;
  /** For interviewer turns: which gap this follow-up targets and at what depth. */
  gap?: GapType;
  level?: 1 | 2 | 3;
  hypothetical?: boolean;
  inputMode?: InputMode;
  /** The transcript as first recognized, before the learner corrected it. */
  rawTranscript?: string;
  /** Measured only when audio was actually captured. */
  durationSec?: number;
}

export interface DiveDeeperState {
  originalQuestion: string;
  principleId: LeadershipPrincipleId | null;
  initialAnswer: string;
  starEvidence: StarEvidence;
  gaps: DetectedGap[];
  followUps: Array<{ turnId: string; gap: GapType; level: 1 | 2 | 3; answered: boolean }>;
  newDetails: string[];
  level: 1 | 2 | 3;
  /** Combined answer text (initial + follow-up answers). */
  combinedAnswer: string;
  finished: boolean;
  finishReason: "sufficient" | "no-new-evidence" | "learner-stopped" | "time" | null;
}

export type ScoreCategory =
  | "star"
  | "ownership"
  | "results"
  | "principle"
  | "clarity"
  | "reflection";

export interface CategoryScore {
  category: ScoreCategory;
  label: string;
  weight: number;
  /** 0-100 */
  score: number;
  evidence: string[];
  gaps: string[];
}

export interface DeliveryObservations {
  wordsPerMinute: number;
  fillerWords: Array<{ word: string; count: number }>;
  longPauses: number;
  durationSec: number;
  /** Always true: delivery metrics are derived from timing + transcript only. */
  note: string;
}

export interface FeedbackReport {
  generatedAt: string;
  source: "rules" | "claude";
  overall: number;
  assessment: string;
  categories: CategoryScore[];
  starBreakdown: StarEvidence;
  strongest: string[];
  missing: string[];
  vagueStatements: string[];
  principleAlignment: string;
  recommendations: string[];
  suggestedFollowUps: string[];
  revisedOutline: { situation: string; task: string; action: string; result: string; learning: string };
  nextPractice: string;
  delivery?: DeliveryObservations;
  /** Honest disclosure of what the evaluator can and cannot judge. */
  limitations: string;
}

export interface InterviewSession {
  id: string;
  schemaVersion: typeof SCHEMA_VERSION;
  mode: InterviewMode;
  startedAt: string;
  endedAt: string | null;
  questionId: string;
  questionText: string;
  principleId: LeadershipPrincipleId | null;
  storyId: string | null;
  inputMode: InputMode;
  turns: InterviewTurn[];
  diveDeeper: DiveDeeperState | null;
  feedback: FeedbackReport | null;
  /** When the learner records an improved answer after coaching. */
  revisedAnswer: string | null;
  revisedFeedback: FeedbackReport | null;
  /** Realistic mode: planned question list + time limit. */
  realistic?: { questionIds: string[]; timeLimitSec: number; currentIndex: number };
}

export interface InterviewQuestion {
  id: string;
  principleId: LeadershipPrincipleId | null;
  text: string;
  /** What interviewers may be listening for. Practice example, not official. */
  listeningFor: string[];
  /** Technical vs behavioral. */
  kind: "behavioral" | "technical";
}

/** A technical question tied to one qualification of a target posting. */
export interface RoleQuestion extends InterviewQuestion {
  roleId: RoleId;
  /** Id of the qualification in the role's list that this question probes. */
  qualificationId: string;
  /** Missions that prepare you to answer it. */
  missionIds: string[];
  kind: "technical";
}

export interface LeadershipPrinciple {
  id: LeadershipPrincipleId;
  name: string;
  /** Verified official Amazon wording (see content/leadershipPrinciples.ts for source + date). */
  official: string;
  plain: string;
  /** One-line practice cue: what to show when answering for this principle. */
  interviewCue: string;
  evidence: string[];
  questions: InterviewQuestion[];
  followUps: string[];
  weakExample: string;
  strongExample: string;
}

/* ------------------------------------------------------------------ */
/* Export / import                                                      */
/* ------------------------------------------------------------------ */

export interface ExportBundle {
  app: "opsforge";
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  profile?: LearnerProfile;
  skills?: SkillState[];
  missions?: MissionProgress[];
  stories?: Story[];
  sessions?: InterviewSession[];
  activity?: ActivityEvent[];
  /** Study objective status (schema 2+). */
  studyObjectives?: StudyObjectiveState[];
  studyUnits?: StudyUnitState[];
}

// ---------------------------------------------------------------------------
// Study: Ascendra's objective catalog as a sibling learning mode. A separate
// content namespace from tracks, skills and missions; the only bridge is the
// curated link table (src/content/study/links.ts). The JSON under
// public/study/ is built from tools/ascendra-catalog by
// scripts/generate-study.mts and loaded on demand.
// ---------------------------------------------------------------------------

/** How an objective is best learned on this platform. */
export type StudyModality = "do-existing" | "do-new" | "read" | "combo" | "explain";

/** Where an objective's modality came from. */
export type StudyModalitySource = "curated" | "suggested" | "default";

export type StudyLink =
  | { kind: "mission"; missionId: string; coverage: "full" | "partial"; note?: string }
  | { kind: "lab"; labId: string; exerciseId?: string; coverage: "full" | "partial"; note?: string }
  | { kind: "engine"; engineId: string };

export interface StudyObjective {
  id: string; // `${unitId}:${n}`, 1-based within the unit
  unitId: string;
  index: number;
  text: string;
  sourceHash: string; // first 12 hex chars of sha256(text); lessons carry it
  kind: "objective" | "bookkeeping";
  modality: StudyModality;
  modalitySource: StudyModalitySource;
  link?: StudyLink;
  labPrompt?: string; // Ascendra's hands-on prompt, where one exists
}

export interface StudyUnit {
  id: string; // `${courseId}:${n}`, 1-based
  index: number;
  title: string;
  weight?: number; // exam weight in percent, certification courses
  rangeLabel?: string; // "Weeks 1-2", "3 credits"
  gate?: string; // one-sentence mastery gate from the source
  gateEngine?: string; // engine id that would make the gate playable
  objectives: StudyObjective[];
}

export interface StudyProvenance {
  sourceRepo: "ascendra";
  sourceFile: string;
  sourceCommit: string;
  sourceVerifiedAt?: string;
  officialObjectivesUrl?: string;
  providerName?: string;
  credentialName?: string;
  examCode?: string;
  credentialStatus?: string; // active, transitioning, beta, retired
  retirementDate?: string;
  note: string;
}

export interface StudyCourse {
  id: string; // exam code lowercased when there is one, else the track code lowercased
  code: string; // Ascendra track code, e.g. AWSSAA
  title: string;
  description: string;
  trackType: "graduate" | "certification";
  field: StudyField;
  /** Health courses: the learner accepts a disclaimer before any lesson is shown. */
  requiresAcknowledgement?: true;
  units: StudyUnit[];
  provenance: StudyProvenance;
  counts: { units: number; objectives: number; bookkeeping: number; linked: number };
}

export interface StudyCourseSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  trackType: "graduate" | "certification";
  group: StudyField;
  level: StudyLevel;
  requiresAcknowledgement?: true;
  examCode?: string;
  credentialStatus?: string;
  retirementDate?: string;
  counts: { units: number; objectives: number; bookkeeping: number; linked: number };
  modalities: Record<StudyModality, number>;
  file: string; // course JSON file name
  hash: string; // sha256 of the course JSON, for cache-busting
}

/** Every objective's text, for search on the Study home. Loaded only when the learner searches. */
export interface StudySearchIndex {
  schemaVersion: 1;
  /** [objective id, objective text]; the id ("saa-c03:2:12") is also the route. */
  objectives: Array<[string, string]>;
}

/** Which courses have lessons, so the Study home can say so without loading every lessons file. */
export interface StudyLessonsIndex {
  schemaVersion: 1;
  courses: Record<string, { generated: number; imported: number; scenarios: number }>;
}

export interface StudyCatalogIndex {
  schemaVersion: 1;
  builtFrom: { sourceRepo: "ascendra"; sourceCommit: string };
  courses: StudyCourseSummary[];
}

/** Ascendra's 0–4 rubric, kept as names; "needs-review" scores 1. */
export type StudyStatus = "not-started" | "introduced" | "guided" | "independent" | "transfer-ready" | "needs-review";
export type StudyAttemptFormat = "mc" | "open" | "pbq" | "mission" | "lab";
export type StudyVerdict = "correct" | "partial" | "incorrect";
/** Who graded: the answer key (auto), the proxy, the learner (self-rated), or a mission's own checks. */
export type StudyAttemptSource = "auto" | "proxy" | "self" | "mission";

export interface StudyAttempt {
  at: string;
  format: StudyAttemptFormat;
  verdict: StudyVerdict;
  source: StudyAttemptSource;
  questionId?: string;
  /** Mission or lab exercise that produced the credit. */
  ref?: string;
}

export interface StudyObjectiveState {
  objectiveId: string;
  courseId: string;
  unitId: string;
  schemaVersion: typeof SCHEMA_VERSION;
  status: StudyStatus;
  /** 0–4, derived from status. */
  score: number;
  /** Last 30 attempts, oldest first. */
  attempts: StudyAttempt[];
  seenQuestionIds: string[];
  /** 0 → review in 1 day, 1 → 7 days, 2 → 21 days, 3 → resolved. */
  reviewStage: number;
  nextReviewAt: string | null;
  lastPracticedAt: string | null;
}

export interface StudyUnitState {
  id: string; // unit id
  courseId: string;
  schemaVersion: typeof SCHEMA_VERSION;
  scenarioAttempts: StudyAttempt[];
}

/** One check question in an objective's bank: the "fade" question is mostly worked, the "solo" ones stand alone. */
export interface StudyChoiceQuestion {
  id: string; // `${objectiveId}:q${n}`
  role: "fade" | "solo";
  prompt: string;
  choices: string[]; // exactly 4
  correctIndex: number;
  why: string;
}

/** Generated lesson for one objective. Static, machine-written, spot-checked by the owner. */
export interface StudyLesson {
  objectiveId: string;
  sourceHash: string; // must equal the catalog objective's hash
  promptVersion: number;
  model: string;
  generatedAt: string;
  /** Beginner paragraph in plain words, no code, like a mission primer. */
  plain: string;
  /** Question the learner attempts from intuition before any teaching. */
  guessPrompt: string;
  /** The teaching: every named term defined, why it works, one worked example, one common mistake. */
  teach: string;
  questions: StudyChoiceQuestion[]; // 1 fade + 3 solo
  /** Explain-it-back prompt, model answer and the points a good answer covers. */
  explainPrompt: string;
  modelAnswer: string;
  rubricPoints: string[];
  /** The generator's view of how this objective is best learned; promoted by hand into links.ts. */
  suggested?: { modality: StudyModality; engineId?: string; missionId?: string; rationale: string };
}

/** Generated multi-part scenario for one unit, graded per sub-part. */
export interface StudyScenario {
  unitId: string;
  promptVersion: number;
  model: string;
  generatedAt: string;
  title: string;
  scenario: string; // ends with 2-4 numbered sub-tasks
  subParts: string[];
  /** The grader's answer key, one entry per sub-part. */
  modelAnswer: string[];
}

export interface StudyLessonsFile {
  courseId: string;
  generated: { scriptVersion: number; promptVersion: number; generatedAt: string; models: string[] };
  lessons: StudyLesson[];
  scenarios: StudyScenario[];
}

/**
 * A lesson Ascendra wrote at request time and cached in its own database,
 * exported from there and converted. Thinner than a generated lesson: no
 * plain paragraph, no explain-it-back, and two questions (one fade, one solo)
 * instead of four. A generated lesson for the same objective replaces it.
 */
export interface StudyImportedLesson {
  objectiveId: string;
  sourceHash: string; // must equal the catalog objective's hash
  model: string;
  generatedAt: string;
  guessPrompt: string;
  teach: string;
  questions: StudyChoiceQuestion[]; // 1 fade + 1 solo
}

export interface StudyImportedFile {
  courseId: string;
  imported: { source: "ascendra"; importedAt: string; models: string[] };
  lessons: StudyImportedLesson[];
}

/** What the lesson player gets: a generated lesson, or an imported one where none is generated yet. */
export type PlayableLesson = ({ origin: "generated" } & StudyLesson) | ({ origin: "imported" } & StudyImportedLesson);
