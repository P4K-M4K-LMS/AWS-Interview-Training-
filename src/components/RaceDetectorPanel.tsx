import { useState } from "react";
import { Link } from "react-router-dom";
import { probeRaceService, runWithRaceService, type RaceRunResult } from "../services/race";
import { Callout } from "./ui";

/**
 * Sends the current Go program to the optional local race-detector service
 * and shows the detector's report verbatim. The browser runtime is
 * single-threaded and cannot see data races, so this is the only honest way
 * to check for them from OpsForge.
 */
export function RaceDetectorPanel({ code, serviceUrl, compact }: { code: string; serviceUrl: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RaceRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const configured = serviceUrl.trim().length > 0;

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await runWithRaceService(serviceUrl, code);
    setResult(r.result);
    setError(r.error);
    setBusy(false);
  };

  return (
    <div className="space-y-2" data-testid="race-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className="btn-secondary" disabled={!configured || busy} onClick={() => void run()} data-testid="race-run">
          {busy ? "Running under the race detector..." : "Run with the race detector (local service)"}
        </button>
        {configured && (
          <button type="button" className="btn-ghost text-xs" onClick={() => void probeRaceService(serviceUrl).then((p) => setProbe(p.summary))}>
            Test connection
          </button>
        )}
        {!configured && (
          <span className="text-xs muted" data-testid="race-unconfigured">
            Not configured. Start <code>npm run race-server</code> on your machine and enter its URL in <Link to="/settings" className="underline">Settings</Link>.
          </span>
        )}
      </div>
      {probe && <div className="text-xs muted">{probe}</div>}
      {error && (
        <Callout kind="warn" title="Race detector service">
          {error}
        </Callout>
      )}
      {result && (
        <div className="space-y-2" data-testid="race-result">
          <div className="text-xs muted">
            Finished in {result.durationMs} ms{result.timedOut ? " (timed out)" : ""}; exit code {result.exitCode ?? "none"}.
          </div>
          {result.buildError ? (
            <pre className="rounded p-2 text-xs whitespace-pre-wrap bg-red-950/50 text-red-200">{result.buildError}</pre>
          ) : result.raceCount > 0 ? (
            <Callout kind="warn" title={`The race detector found ${result.raceCount} data race${result.raceCount === 1 ? "" : "s"}`}>
              <ul className="text-sm space-y-1 mt-1">
                {result.races.slice(0, compact ? 3 : 10).map((r, i) => (
                  <li key={i}>
                    <span className="font-mono">{r.current.kind}</span> by goroutine {r.current.goroutine} at <span className="font-mono">{r.current.frame || "?"}</span> conflicts with a previous{" "}
                    <span className="font-mono">{r.previous.kind}</span> by goroutine {r.previous.goroutine} at <span className="font-mono">{r.previous.frame || "?"}</span>
                  </li>
                ))}
              </ul>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer">Full detector report</summary>
                <pre className="whitespace-pre-wrap mt-1">{result.races.map((r) => r.raw).join("\n\n")}</pre>
              </details>
            </Callout>
          ) : (
            <Callout kind="info" title="No data races were observed in this run">
              The detector reports only conflicts it actually saw. A clean run is evidence, not proof; runs with more goroutines or different timing can still expose a race.
            </Callout>
          )}
          {result.stdout && !compact && <pre className="terminal rounded p-2 text-xs whitespace-pre-wrap">{result.stdout}</pre>}
        </div>
      )}
    </div>
  );
}
