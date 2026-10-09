import type { DeliveryObservations, DiveDeeperState, FeedbackReport, LeadershipPrincipleId, LearnerSettings } from "../../domain/types";
import { buildRuleBasedFeedback } from "../../engine/interview/scoring";
import { LP_BY_ID } from "../../content/leadershipPrinciples";

/**
 * Coach adapter. The rule-based coach always works offline. The Claude coach
 * talks to the optional local proxy (server/index.ts), which holds the API
 * key; the client never sees it. Any failure falls back to rules and says so.
 */
export interface CoachRequest {
  questionText: string;
  principleId: LeadershipPrincipleId | null;
  answer: string;
  diveDeeper?: DiveDeeperState | null;
  delivery?: DeliveryObservations;
}

export interface CoachResult {
  report: FeedbackReport;
  /** Human-readable note about which engine produced it and why. */
  engineNote: string;
}

export async function getFeedback(req: CoachRequest, settings: LearnerSettings): Promise<CoachResult> {
  const rules = buildRuleBasedFeedback(req);
  if (settings.coachMode !== "claude") return { report: rules, engineNote: "Rule-based coach (offline)." };
  if (!settings.coachConsent) return { report: rules, engineNote: "Claude coaching is selected but consent to send transcripts is not given (Settings). Used rule-based coach." };
  if (!settings.coachProxyUrl) return { report: rules, engineNote: "Claude coaching is selected but no proxy URL is configured (Settings). Used rule-based coach." };
  try {
    const res = await fetch(`${settings.coachProxyUrl.replace(/\/$/, "")}/api/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText: req.questionText,
        principle: req.principleId ? { id: req.principleId, name: LP_BY_ID.get(req.principleId)?.name, official: LP_BY_ID.get(req.principleId)?.official } : null,
        answer: req.answer,
        diveDeeper: req.diveDeeper ? { followUps: req.diveDeeper.followUps.length, newDetails: req.diveDeeper.newDetails, combinedAnswer: req.diveDeeper.combinedAnswer } : null,
        rulesReport: { categories: rules.categories.map((c) => ({ category: c.category, score: c.score })), gaps: rules.missing },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { report: rules, engineNote: `Proxy returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}. Used rule-based coach.` };
    }
    const data = (await res.json()) as Partial<FeedbackReport> & { model?: string };
    const merged = mergeClaudeReport(rules, data);
    return { report: merged, engineNote: `Claude coaching via proxy${data.model ? ` (${data.model})` : ""}. Rule-based scores retained as the transparent baseline.` };
  } catch (e) {
    return { report: rules, engineNote: `Could not reach the coaching proxy (${(e as Error).message}). Used rule-based coach.` };
  }
}

function mergeClaudeReport(rules: FeedbackReport, c: Partial<FeedbackReport>): FeedbackReport {
  const categories = rules.categories.map((rc) => {
    const cc = c.categories?.find((x) => x.category === rc.category);
    return cc && typeof cc.score === "number" ? { ...rc, score: Math.round(Math.max(0, Math.min(100, cc.score))), evidence: cc.evidence?.length ? cc.evidence : rc.evidence, gaps: cc.gaps?.length ? cc.gaps : rc.gaps } : rc;
  });
  const total = categories.reduce((s, x) => s + x.weight, 0);
  const overall = Math.round(categories.reduce((s, x) => s + (x.score * x.weight) / total, 0));
  return {
    ...rules,
    source: "claude",
    overall,
    categories,
    assessment: c.assessment ?? rules.assessment,
    strongest: c.strongest?.length ? c.strongest : rules.strongest,
    missing: c.missing?.length ? c.missing : rules.missing,
    vagueStatements: c.vagueStatements?.length ? c.vagueStatements : rules.vagueStatements,
    principleAlignment: c.principleAlignment ?? rules.principleAlignment,
    recommendations: c.recommendations?.length ? c.recommendations : rules.recommendations,
    suggestedFollowUps: c.suggestedFollowUps?.length ? c.suggestedFollowUps : rules.suggestedFollowUps,
    revisedOutline: c.revisedOutline ?? rules.revisedOutline,
    nextPractice: c.nextPractice ?? rules.nextPractice,
    limitations: "Semantic coaching by a language model via your local proxy. It can misjudge; it cannot verify your facts, and it does not predict hiring outcomes. Delivery metrics, if present, come only from real recording timing.",
  };
}

export async function probeCoachProxy(url: string): Promise<string> {
  if (!url) return "Enter a proxy URL first.";
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return `Proxy responded with HTTP ${res.status}.`;
    const j = (await res.json()) as { ok: boolean; model?: string; hasKey?: boolean };
    return j.hasKey ? `Proxy reachable. Model: ${j.model}. API key configured on the server.` : "Proxy reachable but no API key is configured on the server (set ANTHROPIC_API_KEY).";
  } catch (e) {
    return `Proxy not reachable: ${(e as Error).message}`;
  }
}
