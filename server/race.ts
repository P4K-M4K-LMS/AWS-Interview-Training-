/**
 * OpsForge optional race-detector service.
 *
 * The browser runtime (Yaegi in WebAssembly) is single-threaded, so data
 * races cannot be reproduced there. This small HTTP service runs on the
 * learner's own machine, compiles the submitted program with `go build -race`
 * and runs it, returning the detector's report. It executes the code it
 * receives exactly as `go run` would, so only run it on your own machine and
 * keep it bound to localhost.
 *
 *   npm run race-server          (needs Go 1.22+ and a C compiler on PATH)
 *
 * Endpoints:
 *   GET  /api/health -> { ok, goVersion, raceSupported, detail }
 *   POST /api/race   -> RaceRunResult (see server/race-core.ts)
 */
import { createServer } from "node:http";
import { probeGo, runWithRaceDetector } from "./race-core.js";

const PORT = Number(process.env.RACE_PORT ?? 8788);
const HOST = process.env.RACE_HOST ?? "127.0.0.1";
const ALLOWED_ORIGIN = process.env.RACE_ALLOWED_ORIGIN ?? "*";
const TIMEOUT_MS = Number(process.env.RACE_TIMEOUT_MS ?? 60_000);

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

let probe: Awaited<ReturnType<typeof probeGo>> | null = null;
let busy = false;

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/api/health") {
    probe = probe ?? (await probeGo());
    return json(res, 200, { ok: true, ...probe });
  }
  if (req.method === "POST" && req.url === "/api/race") {
    probe = probe ?? (await probeGo());
    if (!probe.raceSupported) return json(res, 503, { error: probe.detail });
    if (busy) return json(res, 429, { error: "A run is already in progress; try again when it finishes." });
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 200_000) return json(res, 413, { error: "Program too large." });
    }
    let input: { code?: string };
    try {
      input = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON." });
    }
    if (!input.code || typeof input.code !== "string") return json(res, 400, { error: "code is required." });
    busy = true;
    try {
      return json(res, 200, await runWithRaceDetector(input.code, { timeoutMs: TIMEOUT_MS }));
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    } finally {
      busy = false;
    }
  }
  json(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, async () => {
  probe = await probeGo();
  console.log(`OpsForge race-detector service listening on http://${HOST}:${PORT}`);
  console.log(`  ${probe.goVersion ?? "Go not found"}; ${probe.detail}`);
  console.log("  Runs the Go code it receives on this machine. Keep it bound to localhost.");
});
