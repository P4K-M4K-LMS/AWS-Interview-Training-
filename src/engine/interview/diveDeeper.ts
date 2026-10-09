import type { DetectedGap, DiveDeeperState, GapType, LeadershipPrincipleId } from "../../domain/types";
import { LP_BY_ID } from "../../content/leadershipPrinciples";
import { analyzeAnswer } from "./star";

/**
 * Dive Deeper Mode: a persistent interviewer that targets the most important
 * unresolved gap with one focused follow-up at a time, across three depth
 * levels. State is explicit and serializable so a session can be saved.
 */

const GAP_PRIORITY: GapType[] = ["technical-detail", "ownership", "results", "decision-making", "task", "situation", "principle", "learning"];

interface FollowUpTemplate {
  level: 1 | 2 | 3;
  hypothetical?: boolean;
  text: (ctx: { lastAnswer: string; principle: string | null; quote?: string }) => string;
}

const FOLLOW_UPS: Record<GapType, FollowUpTemplate[]> = {
  ownership: [
    { level: 1, text: ({ quote }) => quote ? `You said "${quote}". What did you personally do in that part?` : "What did you personally do, as opposed to the team as a whole?" },
    { level: 2, text: () => "What was your exact responsibility, and which decisions were yours alone to make?" },
    { level: 3, text: () => "If you had been removed from the team halfway through, which parts of the outcome would not have happened? Be specific about your contribution." },
  ],
  "technical-detail": [
    { level: 1, text: () => "What was the first thing you checked, and why that first?" },
    { level: 2, text: () => "Which tools, commands, logs, code or data did you use to find the cause? Walk me through the diagnostic steps in order." },
    { level: 3, text: () => "What evidence told you that your fix addressed the root cause rather than a symptom? How could you have been wrong?" },
  ],
  "decision-making": [
    { level: 1, text: () => "Why did you choose that approach?" },
    { level: 2, text: () => "Which alternatives did you consider, and what tradeoffs made you reject them?" },
    { level: 3, hypothetical: true, text: () => "Hypothetically: suppose your chosen approach had failed under real load. What would you have tried next, and what would that have cost?" },
  ],
  results: [
    { level: 1, text: () => "What was the outcome, concretely? What changed for the users or the system?" },
    { level: 2, text: () => "How was the improvement measured or verified? What were the numbers before and after, if you know them?" },
    { level: 3, text: () => "Did the result hold over time, and how did you know? Were there any side effects or costs?" },
  ],
  learning: [
    { level: 1, text: () => "What did you learn from this?" },
    { level: 2, text: () => "What would you do differently next time, and why?" },
    { level: 3, text: () => "How has that lesson changed something you have done since?" },
  ],
  principle: [
    { level: 1, text: ({ principle }) => `Where in this story do you see "${principle}" showing up in what you did?` },
    { level: 2, text: ({ principle }) => `Tell me about a moment in this situation where "${principle}" was hard to live up to. What did you do?` },
    { level: 3, text: ({ principle }) => `What would a weaker example of "${principle}" have looked like here, and how did your actions differ?` },
  ],
  situation: [
    { level: 1, text: () => "Set the scene for me: when was this, where were you, and what was going on?" },
    { level: 2, text: () => "What constraints were you under at the time (deadline, resources, experience)?" },
    { level: 3, text: () => "What was at stake if nothing had been done?" },
  ],
  task: [
    { level: 1, text: () => "What exactly needed to be accomplished, and what was your role in it?" },
    { level: 2, text: () => "How did you know what success would look like at the start?" },
    { level: 3, text: () => "Was the task you ended up doing different from the one you were given? How did that happen?" },
  ],
};

export function createDiveDeeperState(question: string, principleId: LeadershipPrincipleId | null, initialAnswer: string): DiveDeeperState {
  const a = analyzeAnswer(initialAnswer, principleId);
  return {
    originalQuestion: question,
    principleId,
    initialAnswer,
    starEvidence: a.evidence,
    gaps: a.gaps,
    followUps: [],
    newDetails: [],
    level: 1,
    combinedAnswer: initialAnswer,
    finished: false,
    finishReason: null,
  };
}

/** Picks the most important unresolved gap not yet asked at the current level. */
export function chooseGap(state: DiveDeeperState): DetectedGap | null {
  const asked = new Map<GapType, number>();
  for (const f of state.followUps) asked.set(f.gap, Math.max(asked.get(f.gap) ?? 0, f.level));
  const candidates = state.gaps
    .filter((g) => !g.resolved)
    .filter((g) => (asked.get(g.type) ?? 0) < 3)
    .sort((x, y) => y.severity - x.severity || GAP_PRIORITY.indexOf(x.type) - GAP_PRIORITY.indexOf(y.type) || (asked.get(x.type) ?? 0) - (asked.get(y.type) ?? 0));
  return candidates[0] ?? null;
}

export interface NextFollowUp {
  gap: GapType;
  level: 1 | 2 | 3;
  text: string;
  hypothetical: boolean;
}

export function nextFollowUp(state: DiveDeeperState, turnId: string): { state: DiveDeeperState; followUp: NextFollowUp | null } {
  if (state.finished) return { state, followUp: null };
  const gap = chooseGap(state);
  if (!gap) return { state: { ...state, finished: true, finishReason: "sufficient" }, followUp: null };
  const askedForGap = state.followUps.filter((f) => f.gap === gap.type).length;
  // Depth: escalates with how many times this gap has been probed, capped by the learner's readiness level.
  const level = Math.min(3, Math.max(1, askedForGap + 1), Math.max(state.level, 1)) as 1 | 2 | 3;
  const templates = FOLLOW_UPS[gap.type];
  const t = templates.find((x) => x.level === level) ?? templates[0];
  const principle = state.principleId ? (LP_BY_ID.get(state.principleId)?.name ?? null) : null;
  const quote = gap.evidence.find((e) => !e.startsWith('"I"') && !/^No |^Your |^Actions|^An outcome|^The |^The result/.test(e));
  const text = t.text({ lastAnswer: state.combinedAnswer, principle, quote: quote?.slice(0, 120) });
  return {
    state: { ...state, followUps: [...state.followUps, { turnId, gap: gap.type, level, answered: false }] },
    followUp: { gap: gap.type, level, text, hypothetical: Boolean(t.hypothetical) },
  };
}

const DONT_KNOW = /\b(i don'?t (know|remember|recall)|not sure|can'?t remember|no idea|i'm not certain)\b/i;

/**
 * Incorporates a follow-up answer: re-analyzes the combined text, marks gaps
 * resolved when the new evidence covers them, and records new details.
 * "I don't know" is always accepted and closes that gap without penalty.
 */
export function applyFollowUpAnswer(state: DiveDeeperState, answer: string): { state: DiveDeeperState; addedEvidence: boolean } {
  const pending = [...state.followUps].reverse().find((f) => !f.answered);
  const combined = `${state.combinedAnswer}\n${answer}`;
  const before = analyzeAnswer(state.combinedAnswer, state.principleId);
  const after = analyzeAnswer(combined, state.principleId);
  const afterTypes = new Map(after.gaps.map((g) => [g.type, g]));
  const admitted = DONT_KNOW.test(answer);
  const trivial = answer.trim().split(/\s+/).length < 4 && !admitted;

  let addedEvidence = false;
  const gaps: DetectedGap[] = state.gaps.map((g) => {
    if (g.resolved) return g;
    const stillThere = afterTypes.get(g.type);
    if (pending && pending.gap === g.type && admitted) return { ...g, resolved: true, evidence: [...g.evidence, "Learner said they do not know/remember. Accepted."] };
    if (!stillThere) {
      addedEvidence = true;
      return { ...g, resolved: true };
    }
    if (stillThere.severity < g.severity) {
      addedEvidence = true;
      return { ...g, severity: stillThere.severity, evidence: stillThere.evidence };
    }
    return g;
  });
  // Any brand-new gap types surfaced by the longer text are added (rare, e.g. new vague claims).
  for (const g of after.gaps) if (!gaps.some((x) => x.type === g.type)) gaps.push(g);

  const newDetails = [...state.newDetails];
  const newSentences = after.sentences.filter((s) => !before.sentences.includes(s));
  const evidential = newSentences.filter((s) => after.evidence.action.includes(s) || after.evidence.result.includes(s) || after.decisionCues.includes(s) || after.technicalCues.includes(s) || after.evidence.learning.includes(s));
  if (evidential.length) {
    addedEvidence = true;
    newDetails.push(...evidential);
  }

  const followUps = state.followUps.map((f) => (f === pending ? { ...f, answered: true } : f));
  // Readiness: detailed answers raise the depth level; thin answers keep it.
  const level = (addedEvidence && !trivial ? Math.min(3, state.level + 1) : state.level) as 1 | 2 | 3;

  // Stop when follow-ups stop adding evidence (two consecutive non-evidential answers).
  const recent = followUps.slice(-2);
  const stale = recent.length === 2 && recent.every((f) => f.answered) && !addedEvidence && !admitted && state.followUps.length >= 3;
  const unresolved = gaps.filter((g) => !g.resolved && g.severity >= 2);
  const finished = stale || unresolved.length === 0 || followUps.length >= 8;
  return {
    state: {
      ...state,
      gaps,
      newDetails,
      followUps,
      level,
      combinedAnswer: combined,
      starEvidence: after.evidence,
      finished,
      finishReason: finished ? (unresolved.length === 0 ? "sufficient" : "no-new-evidence") : null,
    },
    addedEvidence,
  };
}

export function stopDiveDeeper(state: DiveDeeperState, reason: "learner-stopped" | "time"): DiveDeeperState {
  return { ...state, finished: true, finishReason: reason };
}
