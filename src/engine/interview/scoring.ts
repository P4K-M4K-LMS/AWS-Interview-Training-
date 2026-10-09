import type { CategoryScore, DeliveryObservations, DiveDeeperState, FeedbackReport, LeadershipPrincipleId, ScoreCategory } from "../../domain/types";
import { LP_BY_ID } from "../../content/leadershipPrinciples";
import { analyzeAnswer, GAP_LABELS, type AnalyzedAnswer } from "./star";
import { nowIso } from "../../data/db";

/** Application-designed coaching weights. Not Amazon's criteria. */
export const RUBRIC: Array<{ category: ScoreCategory; label: string; weight: number }> = [
  { category: "star", label: "STAR structure and completeness", weight: 20 },
  { category: "ownership", label: "Personal actions and ownership", weight: 25 },
  { category: "results", label: "Results and supporting evidence", weight: 20 },
  { category: "principle", label: "Leadership Principle alignment", weight: 15 },
  { category: "clarity", label: "Clarity and relevance", weight: 10 },
  { category: "reflection", label: "Reflection and learning", weight: 10 },
];

export const RULES_LIMITATIONS =
  "This feedback is produced by transparent rules that look for STAR cues, first-person actions, reasoning words, numbers and reflection in your transcript. It cannot verify facts, judge technical correctness, or understand nuance, and scores are coaching signals, not predictions of any hiring outcome.";

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreAnswer(a: AnalyzedAnswer, principleId: LeadershipPrincipleId | null, questionText: string): CategoryScore[] {
  const e = a.evidence;
  const star = clamp(
    (e.situation.length ? 25 : 0) + (e.task.length ? 20 : 0) + (e.action.length ? Math.min(35, 15 + e.action.length * 7) : 0) + (e.result.length ? 20 : 0),
  );
  const ownership = clamp(
    (a.ownership.iCount === 0 ? 0 : 40) + Math.min(35, a.ownership.ratio * 50) + Math.min(25, e.action.length * 8) - a.ownership.vagueCollective.length * 8,
  );
  const results = clamp((e.result.length ? 45 : 0) + Math.min(35, a.numbers.length * 15) + (/\b(verified|measured|confirmed|monitored|checked|tested)\b/i.test(a.text) ? 20 : 0) - a.vagueStatements.length * 5);
  let principle = 50;
  if (principleId) {
    principle = clamp(a.principleCues.length === 0 ? 15 : Math.min(100, 45 + a.principleCues.length * 20));
  }
  const relevance = questionText ? overlap(questionText, a.text) : 0.5;
  const clarity = clamp(
    (a.wordCount < 40 ? 20 : a.wordCount < 80 ? 50 : a.wordCount <= 350 ? 85 : 60) + relevance * 15 - a.vagueStatements.length * 6,
  );
  const reflection = clamp(e.learning.length === 0 ? 10 : Math.min(100, 55 + e.learning.length * 25));

  const scores: Record<ScoreCategory, number> = { star, ownership, results, principle, clarity, reflection };
  return RUBRIC.map((r) => ({
    category: r.category,
    label: r.label,
    weight: r.weight,
    score: scores[r.category],
    evidence: evidenceFor(r.category, a, principleId),
    gaps: gapsFor(r.category, a, principleId),
  }));
}

function overlap(q: string, answer: string): number {
  const stop = new Set(["tell", "me", "about", "a", "time", "when", "you", "the", "your", "an", "of", "to", "and", "that", "with", "had", "how", "did", "what", "were", "was", "in", "on", "it", "for"]);
  const qw = new Set(q.toLowerCase().match(/[a-z]+/g)?.filter((w) => !stop.has(w) && w.length > 3) ?? []);
  if (!qw.size) return 0.5;
  const aw = new Set(answer.toLowerCase().match(/[a-z]+/g) ?? []);
  let hit = 0;
  for (const w of qw) if (aw.has(w) || aw.has(w + "s") || aw.has(w.replace(/s$/, ""))) hit++;
  return hit / qw.size;
}

function evidenceFor(c: ScoreCategory, a: AnalyzedAnswer, principleId: LeadershipPrincipleId | null): string[] {
  const e = a.evidence;
  switch (c) {
    case "star":
      return [
        `Situation: ${e.situation.length ? "present" : "missing"}`,
        `Task: ${e.task.length ? "present" : "missing"}`,
        `Action: ${e.action.length} action sentence(s)`,
        `Result: ${e.result.length ? "present" : "missing"}`,
      ];
    case "ownership":
      return [`"I/my" used ${a.ownership.iCount} time(s); "we/the team" ${a.ownership.weCount} time(s).`, ...e.action.slice(0, 2).map((s) => `Action: "${s}"`)];
    case "results":
      return [...e.result.slice(0, 2).map((s) => `Result: "${s}"`), a.numbers.length ? `Numbers mentioned: ${a.numbers.slice(0, 4).join(", ")}` : "No numbers or before/after comparison."];
    case "principle":
      return principleId ? (a.principleCues.length ? a.principleCues.slice(0, 2).map((s) => `Cue: "${s}"`) : [`No wording in the answer visibly connects to ${LP_BY_ID.get(principleId)?.name ?? principleId}.`]) : ["No principle selected; not scored against one."];
    case "clarity":
      return [`${a.wordCount} words, ${a.sentences.length} sentences.`, ...(a.vagueStatements.length ? [`${a.vagueStatements.length} vague statement(s) flagged.`] : [])];
    case "reflection":
      return e.learning.length ? e.learning.slice(0, 2).map((s) => `Reflection: "${s}"`) : ["No lesson or reflection stated."];
  }
}

function gapsFor(c: ScoreCategory, a: AnalyzedAnswer, principleId: LeadershipPrincipleId | null): string[] {
  const map: Partial<Record<ScoreCategory, string[]>> = {
    star: a.gaps.filter((g) => ["situation", "task", "technical-detail", "results"].includes(g.type)).map((g) => GAP_LABELS[g.type]),
    ownership: a.gaps.filter((g) => g.type === "ownership").flatMap((g) => g.evidence),
    results: a.gaps.filter((g) => g.type === "results").flatMap((g) => g.evidence),
    principle: principleId ? a.gaps.filter((g) => g.type === "principle").flatMap((g) => g.evidence) : [],
    clarity: a.vagueStatements.slice(0, 3),
    reflection: a.gaps.filter((g) => g.type === "learning").flatMap((g) => g.evidence),
  };
  return map[c] ?? [];
}

export function overallScore(categories: CategoryScore[]): number {
  const total = categories.reduce((s, c) => s + c.weight, 0);
  return Math.round(categories.reduce((s, c) => s + (c.score * c.weight) / total, 0));
}

export interface BuildFeedbackInput {
  questionText: string;
  principleId: LeadershipPrincipleId | null;
  answer: string;
  diveDeeper?: DiveDeeperState | null;
  delivery?: DeliveryObservations;
}

export function buildRuleBasedFeedback(input: BuildFeedbackInput): FeedbackReport {
  const a = analyzeAnswer(input.answer, input.principleId);
  const categories = scoreAnswer(a, input.principleId, input.questionText);
  const overall = overallScore(categories);
  const principleName = input.principleId ? (LP_BY_ID.get(input.principleId)?.name ?? input.principleId) : null;

  const strongest: string[] = [];
  if (a.evidence.action.length >= 2) strongest.push(`Concrete actions: "${a.evidence.action[0]}"`);
  if (a.numbers.length) strongest.push(`Measured result: ${a.numbers.slice(0, 3).join(", ")}`);
  if (a.decisionCues.length) strongest.push(`Reasoning: "${a.decisionCues[0]}"`);
  if (a.evidence.learning.length) strongest.push(`Reflection: "${a.evidence.learning[0]}"`);
  if (a.principleCues.length && principleName) strongest.push(`${principleName} cue: "${a.principleCues[0]}"`);
  if (!strongest.length) strongest.push("No strong supporting examples were detected yet; the recommendations below show where to add them.");

  const missing = a.gaps.filter((g) => !g.resolved).map((g) => `${GAP_LABELS[g.type]}: ${g.evidence[0] ?? ""}`);

  const recommendations: string[] = [];
  for (const g of a.gaps.filter((g) => !g.resolved).slice(0, 5)) {
    switch (g.type) {
      case "ownership":
        recommendations.push("Replace 'we' with 'I' wherever you personally acted, and name the decisions that were yours.");
        break;
      case "technical-detail":
        recommendations.push("Add the diagnostic steps in order: what you checked first, which tool/log/command you used, what it showed.");
        break;
      case "decision-making":
        recommendations.push("State why you chose your approach and at least one alternative you rejected, with the tradeoff.");
        break;
      case "results":
        recommendations.push("Give the outcome with a number, a before/after comparison, or how you verified it. If you do not know a number, say what you observed instead; do not invent one.");
        break;
      case "learning":
        recommendations.push("Close with one sentence on what you learned or would do differently.");
        break;
      case "principle":
        recommendations.push(`Make the connection to ${principleName} explicit: which action showed it, and why that was hard.`);
        break;
      case "situation":
        recommendations.push("Open with one or two sentences of context: when, where, what was going on.");
        break;
      case "task":
        recommendations.push("State your specific responsibility or goal in one sentence.");
        break;
    }
  }
  if (a.wordCount > 350) recommendations.push("Tighten the answer: aim for roughly 90 seconds spoken (150-250 words).");
  if (a.wordCount < 60) recommendations.push("The answer is very short. Expand each STAR section with one or two specific sentences.");

  const suggestedFollowUps = a.gaps.slice(0, 3).map((g) => {
    switch (g.type) {
      case "ownership":
        return "What did you personally do?";
      case "technical-detail":
        return "How did you identify the problem? What evidence supported your conclusion?";
      case "decision-making":
        return "Which alternatives did you consider, and why did you choose that approach?";
      case "results":
        return "What was the outcome, and how was the improvement measured?";
      case "learning":
        return "What would you do differently next time?";
      case "principle":
        return `Where does ${principleName} show up in what you did?`;
      case "situation":
        return "Can you set the scene: when and where was this?";
      case "task":
        return "What exactly was your responsibility?";
    }
  });

  const revisedOutline = {
    situation: a.evidence.situation[0] ?? "[Add context: when, where, what was going on]",
    task: a.evidence.task[0] ?? "[Add your specific responsibility or goal]",
    action: a.evidence.action.length ? a.evidence.action.slice(0, 3).join(" ") : "[Add 2-3 sentences: what you did, in order, with tools/evidence and why]",
    result: a.evidence.result[0] ?? "[Add the outcome with a measure or verification; if unknown, describe what you observed]",
    learning: a.evidence.learning[0] ?? "[Add one lesson or what you would do differently]",
  };

  const topGap = a.gaps[0]?.type;
  const nextPractice =
    topGap === "ownership"
      ? "Guided Mode: rebuild this answer one STAR section at a time, writing the Action section in first person only."
      : topGap === "results"
        ? "Story Bank: add 'supporting evidence' to this story, then retry the question in Practice Mode."
        : topGap === "technical-detail"
          ? "Complete a technical mission, then answer its reflection prompt to practise narrating diagnostic steps."
          : "Practice Mode: answer a different question for the same Leadership Principle.";

  const assessmentParts: string[] = [];
  assessmentParts.push(overall >= 75 ? "Solid STAR answer with real evidence." : overall >= 50 ? "The outline of a STAR answer is there, but key evidence is missing." : "The answer needs substantially more specifics to be convincing.");
  if (input.diveDeeper?.newDetails.length) assessmentParts.push(`Dive Deeper surfaced ${input.diveDeeper.newDetails.length} additional detail(s); fold them into your main answer.`);
  if (a.vagueStatements.length) assessmentParts.push(`${a.vagueStatements.length} statement(s) are vague and will invite follow-ups.`);

  return {
    generatedAt: nowIso(),
    source: "rules",
    overall,
    assessment: assessmentParts.join(" "),
    categories,
    starBreakdown: a.evidence,
    strongest,
    missing,
    vagueStatements: a.vagueStatements,
    principleAlignment: principleName
      ? a.principleCues.length
        ? `${a.principleCues.length} sentence(s) connect to ${principleName}.`
        : `No sentence visibly demonstrates ${principleName}.`
      : "No principle selected for this question.",
    recommendations,
    suggestedFollowUps,
    revisedOutline,
    nextPractice,
    delivery: input.delivery,
    limitations: RULES_LIMITATIONS,
  };
}

/** Compares two reports on explicit criteria; improvement is only declared with stronger evidence. */
export function compareFeedback(original: FeedbackReport, revised: FeedbackReport): { improved: boolean; summary: string; deltas: Array<{ label: string; before: number; after: number }> } {
  const deltas = original.categories.map((c) => ({ label: c.label, before: c.score, after: revised.categories.find((r) => r.category === c.category)?.score ?? c.score }));
  const strongerEvidence = revised.starBreakdown.action.length >= original.starBreakdown.action.length && revised.starBreakdown.result.length >= original.starBreakdown.result.length && revised.missing.length <= original.missing.length;
  const improved = revised.overall > original.overall && strongerEvidence;
  const summary = improved
    ? `Improved: overall ${original.overall} -> ${revised.overall}, with ${original.missing.length - revised.missing.length} fewer gap(s).`
    : revised.overall > original.overall
      ? `Score rose (${original.overall} -> ${revised.overall}) but the evidence did not get stronger (actions/results/gaps). Not counted as an improvement.`
      : `No improvement: overall ${original.overall} -> ${revised.overall}.`;
  return { improved, summary, deltas };
}
