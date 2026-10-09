import { useRef, useState } from "react";
import { db, exportAll, importAll, resetAll, updateProfile, validateBundle } from "../data/db";
import { useProfile } from "../data/hooks";
import { Callout, PageHeader, Panel } from "../components/ui";
import { voiceCapabilities } from "../services/voice/capabilities";
import { probeCoachProxy } from "../services/coach";
import { probeRaceService } from "../services/race";
import { FEATURE_STATUS } from "../content/featureStatus";
import { ROLES, roleFor } from "../content/roles";
import { Link } from "react-router-dom";

export function SettingsPage() {
  const profile = useProfile();
  const [msg, setMsg] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [raceProbe, setRaceProbe] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;
  const s = profile.settings;
  const set = (patch: Partial<typeof s>) => void updateProfile({ settings: { ...s, ...patch } });
  const caps = voiceCapabilities();

  const doExport = async () => {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `opsforge-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (file: File) => {
    try {
      const bundle = validateBundle(JSON.parse(await file.text()));
      await importAll(bundle, db, "merge");
      setMsg(`Imported ${bundle.stories?.length ?? 0} stories, ${bundle.sessions?.length ?? 0} sessions, ${bundle.missions?.length ?? 0} mission records.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title="Settings" subtitle="Everything is stored locally in this browser (IndexedDB). Nothing leaves your device unless you enable the optional coaching proxy and consent." />
      {msg && <Callout kind="info">{msg}</Callout>}

      <Panel title="Profile and appearance">
        <label className="label" htmlFor="dn">
          Display name
        </label>
        <input id="dn" className="input max-w-xs" value={profile.displayName} onChange={(e) => void updateProfile({ displayName: e.target.value })} />
        <div className="mt-3 flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={s.theme === "dark"} onChange={() => set({ theme: "dark" })} /> Dark (default)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={s.theme === "light"} onChange={() => set({ theme: "light" })} /> Light
          </label>
        </div>
        <label className="label mt-3" htmlFor="goal">
          Daily goal (minutes)
        </label>
        <input id="goal" type="number" className="input w-28" min={10} max={180} value={s.dailyGoalMinutes} onChange={(e) => set({ dailyGoalMinutes: Math.max(10, Number(e.target.value) || 30) })} />
      </Panel>

      <Panel title="Target role">
        <p className="text-sm muted mb-2">The posting your gap map, recommendations and interview focus are built around. Qualifications are quoted as provided; OpsForge never invents titles or duties.</p>
        <div className="space-y-1 text-sm">
          {ROLES.map((r) => (
            <label key={r.id} className="flex items-start gap-2">
              <input type="radio" name="target-role" checked={roleFor(profile.targetRoleId).id === r.id} onChange={() => void updateProfile({ targetRoleId: r.id })} data-testid={`settings-role-${r.id}`} />
              <span>
                {r.title}
                {r.team && <span className="muted"> · {r.team}</span>}
              </span>
            </label>
          ))}
        </div>
        <Link to="/curriculum" className="text-xs underline mt-2 inline-block">
          See the qualification gap map
        </Link>
      </Panel>

      <Panel title="Voice and privacy">
        <ul className="text-sm space-y-1 mb-3">
          <li>Speech recognition (your voice → text): {caps.recognition ? "available in this browser" : "not available in this browser (text fallback will be used)"}</li>
          <li>Speech synthesis (questions read aloud): {caps.synthesis ? "available" : "not available"}</li>
          <li>Microphone API: {caps.mediaDevices ? "available" : "not available"}</li>
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={s.voiceConsent} onChange={(e) => set({ voiceConsent: e.target.checked })} />
          <span>
            I consent to microphone use for interview practice. Transcripts are stored locally only. Browser speech recognition may send audio to the browser vendor's speech service (for example Chrome uses Google's); OpsForge itself never uploads audio.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={s.speakQuestions} onChange={(e) => set({ speakQuestions: e.target.checked })} /> Read interview questions aloud
        </label>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={s.keepRecordings} onChange={(e) => set({ keepRecordings: e.target.checked })} /> Keep audio recordings locally (off: only transcripts are kept)
        </label>
      </Panel>

      <Panel title="Coaching engine">
        <div className="text-sm space-y-2">
          <label className="flex items-start gap-2">
            <input type="radio" checked={s.coachMode === "rules"} onChange={() => set({ coachMode: "rules" })} />
            <span>
              <strong>Rule-based (default, offline).</strong> Transparent STAR, ownership, evidence and reflection checks. Works everywhere, no keys.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" checked={s.coachMode === "claude"} onChange={() => set({ coachMode: "claude" })} />
            <span>
              <strong>Claude-powered semantic coaching (optional).</strong> Requires running the local proxy (<code>npm run coach-server</code> with an API key on the server). The rule-based engine remains the fallback if the proxy is unreachable.
            </span>
          </label>
          <label className="label" htmlFor="proxy">
            Proxy URL
          </label>
          <div className="flex gap-2">
            <input id="proxy" className="input max-w-md" placeholder="http://localhost:8787" value={s.coachProxyUrl} onChange={(e) => set({ coachProxyUrl: e.target.value })} />
            <button type="button" className="btn-secondary" onClick={() => void probeCoachProxy(s.coachProxyUrl).then(setProbe)}>
              Test
            </button>
          </div>
          {probe && <div className="text-xs muted">{probe}</div>}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={s.coachConsent} onChange={(e) => set({ coachConsent: e.target.checked })} />
            <span>I consent to sending my interview transcripts (never audio) to the proxy above for coaching. Requires network access.</span>
          </label>
        </div>
      </Panel>

      <Panel title="Go race detector (optional local service)">
        <div className="text-sm space-y-2">
          <p className="muted">
            The in-browser Go runtime is single-threaded, so it cannot reproduce data races. A small service on your own machine runs your program with <code>go build -race</code> and returns the detector's report. Start it with <code>npm run race-server</code> (needs Go 1.22+ and a C compiler) and enter its URL. Your code is sent only when you press the race-detector button in the Go lab or a Go mission.
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <label htmlFor="race-url" className="w-32">
              Service URL
            </label>
            <input id="race-url" className="input max-w-md" placeholder="http://localhost:8788" value={s.raceServiceUrl ?? ""} onChange={(e) => set({ raceServiceUrl: e.target.value })} data-testid="race-url" />
            <button type="button" className="btn-secondary" onClick={() => void probeRaceService(s.raceServiceUrl ?? "").then((p) => setRaceProbe(p.summary))}>
              Test
            </button>
          </div>
          {raceProbe && <div className="text-xs muted">{raceProbe}</div>}
        </div>
      </Panel>

      <Panel title="Your data">
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-secondary" onClick={() => void doExport()}>
            Export everything (JSON)
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (window.confirm("Delete ALL progress, stories and interview history from this browser? This cannot be undone. Export first if unsure.")) {
                void resetAll().then(() => window.location.reload());
              }
            }}
          >
            Reset all progress
          </button>
        </div>
      </Panel>

      <Panel title="About: what works today">
        <ul className="text-sm space-y-1">
          {FEATURE_STATUS.map((f) => (
            <li key={f.feature} className="flex gap-2">
              <span className={`badge ${f.status === "verified" ? "border-emerald-500/50 text-emerald-400" : f.status === "partial" ? "border-amber-500/50 text-amber-400" : f.status === "unverified" ? "border-sky-500/50 text-sky-400" : "opacity-70"}`}>{f.status}</span>
              <span>
                <strong>{f.feature}</strong> <span className="muted">{f.note}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs muted mt-3">OpsForge is an independent training tool. It is not affiliated with, endorsed by, or representative of Amazon's hiring process. Interview questions are practice examples.</p>
      </Panel>
    </div>
  );
}
