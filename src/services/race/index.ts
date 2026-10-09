/**
 * Client for the optional local race-detector service (server/race.ts).
 * The browser runtime cannot reproduce data races, so this sends the program
 * to a service on the learner's own machine that runs `go build -race`.
 * Nothing is sent unless the learner configured the URL and pressed the
 * button; results are never fabricated: the service's report is shown as is.
 */
export interface RaceAccess {
  kind: string;
  goroutine: string;
  frame: string;
}

export interface RaceReport {
  current: RaceAccess;
  previous: RaceAccess;
  raw: string;
}

export interface RaceRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  buildError: string | null;
  races: RaceReport[];
  raceCount: number;
}

export interface RaceProbe {
  ok: boolean;
  goVersion: string | null;
  raceSupported: boolean;
  detail: string;
}

const base = (url: string) => url.trim().replace(/\/$/, "");

export async function probeRaceService(url: string): Promise<{ summary: string; probe: RaceProbe | null }> {
  if (!url.trim()) return { summary: "Enter the service URL first (default http://localhost:8788).", probe: null };
  try {
    const res = await fetch(`${base(url)}/api/health`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { summary: `Service responded with HTTP ${res.status}.`, probe: null };
    const probe = (await res.json()) as RaceProbe;
    return { summary: probe.raceSupported ? `Service reachable: ${probe.goVersion}; ${probe.detail}.` : `Service reachable but the race detector is unavailable: ${probe.detail}`, probe };
  } catch (e) {
    return { summary: `Service not reachable: ${(e as Error).message}`, probe: null };
  }
}

export async function runWithRaceService(url: string, code: string): Promise<{ result: RaceRunResult | null; error: string | null }> {
  if (!url.trim()) return { result: null, error: "No race-detector service URL is configured (Settings)." };
  try {
    const res = await fetch(`${base(url)}/api/race`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<RaceRunResult> & { error?: string };
    if (!res.ok) return { result: null, error: body.error ?? `Service returned HTTP ${res.status}.` };
    return { result: body as RaceRunResult, error: null };
  } catch (e) {
    return { result: null, error: `Could not reach the service: ${(e as Error).message}` };
  }
}
