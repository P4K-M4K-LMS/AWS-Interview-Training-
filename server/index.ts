/**
 * OpsForge optional coaching proxy.
 *
 * Runs on the learner's machine (or a server they control) and keeps the
 * Anthropic API key out of the browser. The web app only ever sends
 * transcripts (never audio) to this process, and only after explicit consent
 * in Settings.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run coach-server
 *
 * Endpoints:
 *   GET  /api/health  -> { ok, model, hasKey }
 *   POST /api/coach   -> FeedbackReport-shaped JSON (see src/domain/types.ts)
 */
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.COACH_PORT ?? 8787);
const MODEL = process.env.COACH_MODEL ?? "claude-opus-5-5";
const ALLOWED_ORIGIN = process.env.COACH_ALLOWED_ORIGIN ?? "*";

const SYSTEM = `You are an interview coach for Amazon/AWS-style behavioral interviews, helping a beginner engineer practise STAR answers.
Rules:
- Judge ONLY the transcript provided. Never invent details the learner did not say, and never assume facts are true or false.
- Be demanding but respectful and constructive. No empty praise.
- Do not infer confidence, honesty, emotion or competence from wording.
- Scores are coaching signals on an application-designed rubric, not hiring predictions.
- Output strictly the JSON object requested, nothing else.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessment", "categories", "strongest", "missing", "vagueStatements", "principleAlignment", "recommendations", "suggestedFollowUps", "revisedOutline", "nextPractice"],
  properties: {
    assessment: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "score", "evidence", "gaps"],
        properties: {
          category: { type: "string", enum: ["star", "ownership", "results", "principle", "clarity", "reflection"] },
          score: { type: "integer", minimum: 0, maximum: 100 },
          evidence: { type: "array", items: { type: "string" } },
          gaps: { type: "array", items: { type: "string" } },
        },
      },
    },
    strongest: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" } },
    vagueStatements: { type: "array", items: { type: "string" } },
    principleAlignment: { type: "string" },
    recommendations: { type: "array", items: { type: "string" } },
    suggestedFollowUps: { type: "array", items: { type: "string" } },
    revisedOutline: {
      type: "object",
      additionalProperties: false,
      required: ["situation", "task", "action", "result", "learning"],
      properties: { situation: { type: "string" }, task: { type: "string" }, action: { type: "string" }, result: { type: "string" }, learning: { type: "string" } },
    },
    nextPractice: { type: "string" },
  },
} as const;

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

function cors(res: import("node:http").ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/api/health") return json(res, 200, { ok: true, model: MODEL, hasKey: Boolean(client) });
  if (req.method === "POST" && req.url === "/api/coach") {
    if (!client) return json(res, 503, { error: "ANTHROPIC_API_KEY is not set on the proxy server." });
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 200_000) return json(res, 413, { error: "Request too large." });
    }
    let input: { questionText?: string; principle?: { name?: string; official?: string } | null; answer?: string; diveDeeper?: { newDetails?: string[]; combinedAnswer?: string } | null; rulesReport?: unknown };
    try {
      input = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON." });
    }
    if (!input.answer || !input.questionText) return json(res, 400, { error: "questionText and answer are required." });
    const userPrompt = [
      `Interview question: ${input.questionText}`,
      input.principle ? `Leadership Principle being assessed: ${input.principle.name}. Official description: ${input.principle.official ?? ""}` : "No specific Leadership Principle selected.",
      `Learner's answer (transcript):\n"""\n${input.answer}\n"""`,
      input.diveDeeper?.combinedAnswer && input.diveDeeper.combinedAnswer !== input.answer ? `Additional details from Dive Deeper follow-ups:\n"""\n${input.diveDeeper.combinedAnswer}\n"""` : "",
      input.rulesReport ? `Transparent rule-based baseline (for reference only): ${JSON.stringify(input.rulesReport)}` : "",
      `Rubric weights: STAR structure 20, personal ownership 25, results/evidence 20, principle alignment 15, clarity/relevance 10, reflection/learning 10. Score each 0-100 with quoted evidence from the transcript and specific gaps. Suggest a revised outline using only details the learner actually gave (use [brackets] for parts they still need to supply).`,
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: userPrompt }],
      } as never);
      const msg = response as unknown as { stop_reason: string; content: Array<{ type: string; text?: string }>; model: string };
      if (msg.stop_reason === "refusal") return json(res, 502, { error: "The model declined this request." });
      const text = msg.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = JSON.parse(text);
      return json(res, 200, { ...parsed, model: msg.model });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return json(res, 502, { error: "Invalid API key on the proxy." });
      if (e instanceof Anthropic.RateLimitError) return json(res, 429, { error: "Rate limited by the API. Try again shortly." });
      if (e instanceof Anthropic.APIError) return json(res, 502, { error: `API error ${e.status}: ${e.message}` });
      return json(res, 500, { error: (e as Error).message });
    }
  }
  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`OpsForge coaching proxy listening on http://localhost:${PORT} (model ${MODEL}, key ${client ? "configured" : "MISSING"})`);
});
