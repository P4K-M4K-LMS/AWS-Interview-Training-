/**
 * OpsForge domain model.
 *
 * Every persisted record carries `schemaVersion` so future migrations can be
 * applied in `src/data/db.ts`. Curriculum, missions and Leadership Principle
 * content are static TypeScript (never stored); learner state, stories and
 * interview sessions are stored in IndexedDB.
 */

export const SCHEMA_VERSION = 1 as const;

/* ------------------------------------------------------------------ */
/* Curriculum                                                          */
/* ------------------------------------------------------------------ */

export type TrackId =
  | "linux"
  | "python"
  | "algorithms"
  | "netsec"
  | "devops"
  | "distributed";

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
  /** Qualification from the posting this track supports (never invented). */
  postingAlignment: string;
  skills: Skill[];
}

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export type MissionKind = "terminal" | "python" | "bigo" | "investigation";

export interface LessonBlock {
  /** Short heading shown in the lesson pane. */
  title: string;
  /** Markdown-ish text: paragraphs separated by blank lines; `code` spans and ``` blocks supported. */
  body: string;
}

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

export interface TerminalWorld {
  hostname: string;
  user: string;
  cwd: string;
  fs: FsSpec;
  processes?: SimProcessSpec[];
  services?: SimServiceSpec[];
  env?: Record<string, string>;
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
   * Python source appended after the learner's code; must raise AssertionError
   * (or any exception) on failure. Runs in the same isolated interpreter.
   */
  code: string;
  /** Optional stdin to feed `input()`. */
  stdin?: string;
}

export interface PythonMission extends MissionBase {
  kind: "python";
  starterCode: string;
  /** Known-good solution used by the automated mission verification tests. */
  referenceSolution: string;
  tests: PythonTestCase[];
  /** Common error -> explanation mapping shown next to tracebacks. */
  errorHelp?: Array<{ match: RegExp; explanation: string }>;
}

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

export type Mission = TerminalMission | PythonMission | BigOMission | InvestigationMission;

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
  dailyGoalMinutes: number;
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
  /** Reflection answers written after completion (Part 13). */
  reflections: Array<{ prompt: string; answer: string; at: string }>;
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
}
