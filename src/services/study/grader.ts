import type { LearnerSettings, StudyVerdict } from "../../domain/types";

/**
 * Explain-it-back and scenario grading. With the coaching proxy configured
 * and consented, the answer, the question and the key go to the proxy and
 * the verdict comes back with source "proxy", which is what Transfer-ready
 * requires. Otherwise the caller falls back to self-rating and says so. The
 * browser never holds a key.
 */
export interface GradeRequest {
  kind: "explain" | "scenario";
  prompt: string;
  answer: string;
  modelAnswer: string | string[];
  rubricPoints?: string[];
  subParts?: string[];
}

export type GradeResult = { source: "proxy"; verdict: StudyVerdict; feedback: string; missedPoints: string[]; model?: string } | { source: "self"; reason: string };

export function proxyAvailable(settings: Pick<LearnerSettings, "coachMode" | "coachConsent" | "coachProxyUrl">): { ok: true } | { ok: false; reason: string } {
  if (settings.coachMode !== "claude") return { ok: false, reason: "Claude coaching is off (Settings), so you rate your own answer." };
  if (!settings.coachConsent) return { ok: false, reason: "Consent to send text to the proxy is not given (Settings), so you rate your own answer." };
  if (!settings.coachProxyUrl) return { ok: false, reason: "No proxy URL is configured (Settings), so you rate your own answer." };
  return { ok: true };
}

export function buildGradeBody(req: GradeRequest): Record<string, unknown> {
  return {
    kind: req.kind,
    prompt: req.prompt,
    answer: req.answer,
    modelAnswer: req.modelAnswer,
    ...(req.rubricPoints ? { rubricPoints: req.rubricPoints } : {}),
    ...(req.subParts ? { subParts: req.subParts } : {}),
  };
}

const VERDICTS: StudyVerdict[] = ["correct", "partial", "incorrect"];

export async function gradeAnswer(req: GradeRequest, settings: LearnerSettings, fetchImpl: typeof fetch = fetch): Promise<GradeResult> {
  const avail = proxyAvailable(settings);
  if (!avail.ok) return { source: "self", reason: avail.reason };
  try {
    const res = await fetchImpl(`${settings.coachProxyUrl.replace(/\/$/, "")}/api/study/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGradeBody(req)),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { source: "self", reason: `The proxy returned ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}. Rate your own answer instead.` };
    }
    const data = (await res.json()) as { verdict?: string; feedback?: string; missedPoints?: unknown; model?: string };
    if (!VERDICTS.includes(data.verdict as StudyVerdict)) return { source: "self", reason: "The proxy answered without a usable verdict. Rate your own answer instead." };
    return {
      source: "proxy",
      verdict: data.verdict as StudyVerdict,
      feedback: typeof data.feedback === "string" ? data.feedback : "",
      missedPoints: Array.isArray(data.missedPoints) ? data.missedPoints.filter((m): m is string => typeof m === "string") : [],
      model: data.model,
    };
  } catch (e) {
    return { source: "self", reason: `Could not reach the proxy (${(e as Error).message}). Rate your own answer instead.` };
  }
}
