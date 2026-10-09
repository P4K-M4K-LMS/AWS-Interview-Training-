import type { DetectedGap, GapType, LeadershipPrincipleId, StarEvidence } from "../../domain/types";

/**
 * Rule-based STAR analysis.
 *
 * This evaluator reads a transcript and looks for linguistic evidence of each
 * STAR component, ownership, decisions, results and learning. It does NOT
 * understand meaning: it cannot verify that a story is true, judge technical
 * correctness, or detect subtle reasoning. The UI states this limitation.
 */

export interface AnalyzedAnswer {
  text: string;
  sentences: string[];
  wordCount: number;
  evidence: StarEvidence;
  ownership: { iCount: number; weCount: number; ratio: number; vagueCollective: string[] };
  vagueStatements: string[];
  numbers: string[];
  decisionCues: string[];
  technicalCues: string[];
  learningCues: string[];
  principleCues: string[];
  gaps: DetectedGap[];
}

const SITUATION_CUES = /\b(when|while|at the time|last (year|month|week|summer)|in (20\d\d|my|our)|during|the (team|company|project|customer|system|server|service) (was|had|were)|we (were|had)|i was (working|on|part of|responsible))\b/i;
const TASK_CUES = /\b(my (job|task|role|responsibility|goal) (was|were)|i (was|had been) (asked|assigned|responsible|tasked|expected)|needed to|had to|the goal was|i needed|i was responsible for|was expected to|owned)\b/i;
const ACTION_CUES = /\bi (?:then |also |first |next |quickly |immediately |personally |eventually |manually )?(built|wrote|rewrote|created|ran|re-ran|used|checked|tested|investigated|found|fixed|changed|configured|designed|implemented|measured|compared|reviewed|debugged|deployed|automated|scripted|analy[sz]ed|identified|decided|chose|set up|rolled back|restarted|monitored|asked|proposed|documented|traced|reproduced|isolated|patched|added|removed|refactored|called|escalated|paired|led|organi[sz]ed|coordinated|looked|read|opened|examined|searched|queried|considered|rejected|staggered|applied|updated|installed|enabled|disabled|started|stopped|pushed|merged|verified|confirmed|noticed|contacted|spoke|talked|prioriti[sz]ed|scheduled|wrote up|drafted|presented|explained|taught|mentored)\b/i;
const RESULT_CUES = /\b(as a result|the result|resulted in|which (meant|reduced|cut|saved|improved|increased|decreased)|reduced|increased|decreased|improved|saved|cut|went from|dropped|rose|from \d+.* to \d+|\d+\s?%|percent|went live|shipped|launched|passed|no longer|stopped (failing|happening|crashing)|recovered|restored|resolved|zero (errors|incidents|downtime))\b/i;
const LEARNING_CUES = /\b(i learned|lesson|next time|in hindsight|looking back|i would (do|change|have)|taught me|realized|realised|since then|now i (always|never)|takeaway|going forward|what i'd do differently)\b/i;
const DECISION_CUES = /\b(because|so that|in order to|instead of|rather than|the (tradeoff|trade-off|alternative|option)|considered|weighed|chose|decided|option[s]?|compared|versus|vs\.?|the risk)\b/i;
const TECH_CUES = /\b(log[s]?|metric[s]?|dashboard|alert|cpu|memory|disk|latency|error rate|throughput|queue|grep|script|python|bash|shell|sql|query|database|api|endpoint|config|deploy|pipeline|test[s]?|unit test|regression|rollback|restart|ssh|dns|port|firewall|cache|retry|timeout|trace|stack trace|exception|commit|branch|pull request|pr\b|git|docker|container|kubernetes|aws|ec2|s3|lambda|cloudwatch|terraform|ansible|ticket|runbook|postmortem|root cause)\b/i;

const VAGUE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(we|i|they) (fixed|solved|resolved|handled) (the|it|that|everything|the (problem|issue|bug))\b(?![^.]*\b(by|using|with|through|via)\b)/i, label: "claims a fix without saying how" },
  { re: /\bi helped (the )?(team|them|out|everyone)\b(?![^.]*\b(by|with|to)\b)/i, label: "'helped' without specifying the contribution" },
  { re: /\b(everything|it all) (worked out|went (well|fine|smoothly|great))\b/i, label: "outcome described only as 'went well'" },
  { re: /\b(i|we) (improved|optimi[sz]ed|streamlined|enhanced) (the|our) (process|system|performance|workflow|things)\b(?![^.]*\d)/i, label: "improvement claimed without a measure" },
  { re: /\bit was (a )?(success|successful|a great success)\b/i, label: "'successful' without evidence" },
  { re: /\b(we|i) made (the|it|things) (better|faster|more reliable|more efficient)\b(?![^.]*\d)/i, label: "'made it better' without a measure" },
  { re: /\b(a lot|lots|many|several|some|various|a bunch) of (things|stuff|changes|improvements|issues|problems|work)\b/i, label: "quantity left vague ('a lot of things')" },
  { re: /\b(and so on|etc\.?|and stuff|and things like that|you know)\b/i, label: "trailing off instead of being specific" },
  { re: /\b(basically|kind of|sort of) (just )?(fixed|did|handled|worked on) (it|that|things)\b/i, label: "hedged description of the action" },
];

const PRINCIPLE_CUES: Partial<Record<LeadershipPrincipleId, RegExp>> = {
  "customer-obsession": /\b(customer[s]?|user[s]?|client[s]?|end[- ]user|feedback|support ticket|their experience)\b/i,
  ownership: /\b(owned|ownership|took responsibility|my responsibility|followed (it )?through|end to end|not my job|beyond my role|long[- ]term)\b/i,
  "invent-and-simplify": /\b(simplif|invent|automat|new approach|reduced steps|removed|streamlin|rewrote|redesign|from scratch|prototype)\b/i,
  "are-right-a-lot": /\b(judg(e|ment)|evidence|data|assumption[s]?|validated|verified|turned out|hypothesis|i was wrong|changed my mind)\b/i,
  "learn-and-be-curious": /\b(learn(ed|ing)?|curious|read (the )?(docs|documentation)|studied|course|experiment|tried out|researched|asked questions|explored)\b/i,
  "hire-and-develop-the-best": /\b(mentor|coach|onboard|taught|trained|feedback|grow|developed (a|the) (team|junior|colleague)|hire|interview)\b/i,
  "insist-on-the-highest-standards": /\b(standard[s]?|quality|review|rejected|not good enough|raised the bar|test coverage|checklist|defect[s]?|bug[s]? (escaped|shipped))\b/i,
  "think-big": /\b(vision|long[- ]term|scale|bigger picture|proposed|roadmap|strategy|beyond|ambitious|transform)\b/i,
  "bias-for-action": /\b(quickly|right away|immediately|without waiting|calculated risk|reversible|moved fast|took action|didn't wait|experiment)\b/i,
  frugality: /\b(cost|budget|cheap(er)?|free|saved (money|\$)|existing tools|without (buying|spending)|constraint[s]?|resourceful|reused)\b/i,
  "earn-trust": /\b(trust|transparent|honest|admitted|owned up|told (them|the team|my manager)|listened|candid|credit|vocally self[- ]critical)\b/i,
  "dive-deep": /\b(dug into|dive|deep|detail[s]?|root cause|audited|traced|line by line|the data|metrics|logs|anomal|inspected|verified)\b/i,
  "have-backbone-disagree-and-commit": /\b(disagree[d]?|pushed back|challenged|objected|argued|conviction|committed anyway|disagree and commit|respectfully|raised concerns)\b/i,
  "deliver-results": /\b(delivered|shipped|on time|deadline|despite|setback[s]?|completed|finished|met the (goal|target)|results?)\b/i,
  "strive-to-be-earths-best-employer": /\b(safe(ty)?|inclusive|well[- ]being|empathy|team (morale|health)|supported (a|my) (colleague|teammate)|fun|burnout|work environment)\b/i,
  "success-and-scale-bring-broad-responsibility": /\b(responsib|impact|community|environment|society|consequences|at scale|humble|secondary effects|do better)\b/i,
};

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function analyzeAnswer(text: string, principleId: LeadershipPrincipleId | null): AnalyzedAnswer {
  const sentences = splitSentences(text);
  const words = text.split(/\s+/).filter(Boolean);
  const evidence: StarEvidence = { situation: [], task: [], action: [], result: [], learning: [] };
  const decisionCues: string[] = [];
  const technicalCues: string[] = [];
  const learningCues: string[] = [];
  for (const s of sentences) {
    if (SITUATION_CUES.test(s)) evidence.situation.push(s);
    if (TASK_CUES.test(s)) evidence.task.push(s);
    if (ACTION_CUES.test(s)) evidence.action.push(s);
    if (RESULT_CUES.test(s)) evidence.result.push(s);
    if (LEARNING_CUES.test(s)) {
      evidence.learning.push(s);
      learningCues.push(s);
    }
    if (DECISION_CUES.test(s)) decisionCues.push(s);
    if (TECH_CUES.test(s)) technicalCues.push(s);
  }
  // If nothing matched a situation cue but the answer has some length, treat the first sentence as context.
  if (!evidence.situation.length && sentences.length >= 3) evidence.situation.push(sentences[0]);

  const iCount = (text.match(/\b(I|I'm|I've|I'd|my|me)\b/g) ?? []).length;
  const weCount = (text.match(/\b(we|we're|we've|our|us|the team)\b/gi) ?? []).length;
  const ratio = iCount + weCount === 0 ? 0 : iCount / (iCount + weCount);
  const vagueCollective = sentences.filter((s) => /\b(we|the team)\b/i.test(s) && !/\bI\b/.test(s) && /\b(fixed|solved|built|decided|improved|handled|did|worked)\b/i.test(s));

  const vagueStatements: string[] = [];
  for (const s of sentences) {
    for (const p of VAGUE_PATTERNS) {
      if (p.re.test(s)) {
        vagueStatements.push(`"${s}" (${p.label})`);
        break;
      }
    }
  }
  const numbers = text.match(/\b\d[\d,.]*\s?(%|percent|ms|seconds?|minutes?|hours?|days?|weeks?|x|times|users?|customers?|requests?|errors?|tickets?|servers?|dollars|\$)?\b/g)?.filter((n) => n.trim().length > 0) ?? [];
  const principleCues: string[] = [];
  if (principleId && PRINCIPLE_CUES[principleId]) {
    for (const s of sentences) if (PRINCIPLE_CUES[principleId]!.test(s)) principleCues.push(s);
  }

  const gaps = detectGaps({ evidence, iCount, weCount, ratio, vagueCollective, vagueStatements, numbers, decisionCues, technicalCues, learningCues, principleCues, principleId, wordCount: words.length });

  return { text, sentences, wordCount: words.length, evidence, ownership: { iCount, weCount, ratio, vagueCollective }, vagueStatements, numbers, decisionCues, technicalCues, learningCues, principleCues, gaps };
}

interface GapInput {
  evidence: StarEvidence;
  iCount: number;
  weCount: number;
  ratio: number;
  vagueCollective: string[];
  vagueStatements: string[];
  numbers: string[];
  decisionCues: string[];
  technicalCues: string[];
  learningCues: string[];
  principleCues: string[];
  principleId: LeadershipPrincipleId | null;
  wordCount: number;
}

function detectGaps(a: GapInput): DetectedGap[] {
  const gaps: DetectedGap[] = [];
  const add = (type: GapType, severity: 1 | 2 | 3, evidence: string[]) => gaps.push({ type, severity, evidence, resolved: false });

  if (a.evidence.situation.length === 0) add("situation", 2, ["No context about when/where this happened."]);
  if (a.evidence.task.length === 0) add("task", 2, ["Your specific responsibility or goal is not stated."]);
  if (a.evidence.action.length === 0) add("technical-detail", 3, ["No sentence describes a concrete action you took (e.g. 'I checked...', 'I wrote...')."]);
  else if (a.technicalCues.length === 0 && a.evidence.action.length < 2) add("technical-detail", 2, ["Actions are mentioned but without tools, evidence, commands or diagnostic steps."]);

  const ownershipWeak = a.iCount === 0 ? 3 : a.ratio < 0.35 && a.weCount >= 3 ? 2 : a.vagueCollective.length >= 2 ? 1 : 0;
  if (ownershipWeak) add("ownership", ownershipWeak as 1 | 2 | 3, a.vagueCollective.slice(0, 2).length ? a.vagueCollective.slice(0, 2) : [`"I" appears ${a.iCount} time(s), "we/the team" ${a.weCount} time(s).`]);

  if (a.decisionCues.length === 0) add("decision-making", 2, ["No reasoning for why you chose this approach, or what alternatives you considered."]);

  if (a.evidence.result.length === 0) add("results", 3, ["No outcome is described."]);
  else if (a.numbers.length === 0 && a.vagueStatements.some((v) => /measure|evidence|success|went well|better/.test(v))) add("results", 2, ["An outcome is claimed but not measured or verified."]);
  else if (a.numbers.length === 0) add("results", 1, ["The result has no number, before/after comparison or verification step."]);

  if (a.learningCues.length === 0) add("learning", 1, ["No lesson, reflection or 'what I would do differently'."]);

  if (a.principleId && a.principleCues.length === 0) add("principle", 2, ["The answer does not visibly demonstrate the selected Leadership Principle."]);

  return gaps.sort((x, y) => y.severity - x.severity);
}

export const GAP_LABELS: Record<GapType, string> = {
  ownership: "Ownership gap",
  "technical-detail": "Technical detail gap",
  "decision-making": "Decision-making gap",
  results: "Results gap",
  learning: "Learning gap",
  principle: "Leadership Principle gap",
  situation: "Situation gap",
  task: "Task gap",
};
