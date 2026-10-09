import { useState } from "react";
import { Link } from "react-router-dom";
import { STAGES, TRACKS } from "../content/curriculum";
import { missionsForTrack } from "../content/missions";
import { COVERAGE_LABELS, ROLES, roleFor } from "../content/roles";
import { useMissionStatuses, useProfile } from "../data/hooks";
import { updateProfile } from "../data/db";
import { masteryLabel } from "../engine/learner/mastery";
import { roleGapMap } from "../engine/learner/roleGap";
import { Callout, PageHeader, Panel, ProgressBar, StatusBadge } from "../components/ui";
import type { TrackId } from "../domain/types";

/** The free-play lab each track uses. */
const TRACK_LAB: Record<TrackId, { to: string; label: string }> = {
  linux: { to: "/labs/terminal", label: "Terminal lab" },
  python: { to: "/labs/python", label: "Python lab" },
  algorithms: { to: "/labs/algorithms", label: "Algorithms lab" },
  netsec: { to: "/labs/security", label: "Security lab" },
  devops: { to: "/labs/monitoring", label: "Monitoring lab" },
  distributed: { to: "/labs/monitoring", label: "Monitoring lab" },
  serverless: { to: "/labs/monitoring", label: "Monitoring lab" },
};

type Lens = "tracks" | "role";

/**
 * One explorable curriculum: tracks → skills, missions and the matching lab,
 * with the target role's gap map as a second lens over the same data.
 */
export function CurriculumPage() {
  const { statuses, progress, skills } = useMissionStatuses();
  const profile = useProfile();
  const role = roleFor(profile?.targetRoleId);
  const gap = roleGapMap(role, skills, progress);
  const [lens, setLens] = useState<Lens>("tracks");
  const [openTrack, setOpenTrack] = useState<TrackId | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Curriculum"
        subtitle="Seven tracks with prerequisites, the missions in each, the lab behind them, and how far they take you toward your target role. Mastery comes only from missions, independent solves and retention checks."
        actions={
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div role="tablist" aria-label="Curriculum lens" className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <button type="button" role="tab" aria-selected={lens === "tracks"} className={`px-3 py-1.5 ${lens === "tracks" ? "bg-amber-500/15 text-amber-500 font-medium" : "muted"}`} onClick={() => setLens("tracks")} data-testid="lens-tracks">
                By track
              </button>
              <button type="button" role="tab" aria-selected={lens === "role"} className={`px-3 py-1.5 ${lens === "role" ? "bg-amber-500/15 text-amber-500 font-medium" : "muted"}`} onClick={() => setLens("role")} data-testid="lens-role">
                By target role
              </button>
            </div>
            <label className="flex items-center gap-2">
              <span className="muted">Target role</span>
              <select className="input text-xs py-1" value={role.id} onChange={(e) => void updateProfile({ targetRoleId: e.target.value as typeof role.id })} data-testid="role-select" aria-label="Target role">
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      {lens === "role" && (
        <Panel title="Target role: qualification gap map">
          <div className="text-sm">
            <div className="font-semibold" data-testid="role-title">{role.title}</div>
            <div className="text-xs muted">
              {[role.team, role.location, role.updated ? `updated ${role.updated}` : null].filter(Boolean).join(" · ") || "No team, location or date was provided."} Source: {role.source}
            </div>
            {role.descriptionExcerpt && <p className="text-xs muted mt-1 italic">{role.descriptionExcerpt}</p>}
          </div>
          <div className="mt-3">
            <ProgressBar value={gap.trainablePct} label={`${gap.trainablePct}% average mastery across the ${gap.qualifications.filter((q) => q.pct !== null).length} qualifications OpsForge can train (${gap.counts["not-addressable"]} not addressable, ${gap.counts.planned} planned)`} />
          </div>
          <ul className="mt-4 space-y-3" data-testid="gap-map">
            {gap.qualifications.map((g) => (
              <li key={g.qualification.id} className="panel-2 p-3 text-sm" data-testid={`gap-${g.qualification.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="badge mr-2">{g.qualification.kind}</span>
                    {g.qualification.text}
                  </div>
                  <span className={`badge ${g.qualification.coverage === "trainable" ? "border-emerald-500/50 text-emerald-400" : g.qualification.coverage === "partial" ? "border-amber-500/50 text-amber-400" : g.qualification.coverage === "planned" ? "border-sky-500/50 text-sky-400" : "opacity-70"}`}>
                    {COVERAGE_LABELS[g.qualification.coverage]}
                  </span>
                </div>
                <p className="text-xs muted mt-1">{g.qualification.note}</p>
                {g.pct !== null && (
                  <div className="mt-2 grid md:grid-cols-2 gap-3">
                    <div>
                      <ProgressBar value={g.pct} label={`${g.pct}% · ${masteryLabel(g.pct)}`} />
                      <ul className="text-xs mt-1 space-y-0.5">
                        {g.skills.map((s) => (
                          <li key={s.id} className="flex justify-between">
                            <span>{s.name}</span>
                            <span className="muted">{s.mastery}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="label">Missions that build it</div>
                      <ul className="text-xs space-y-0.5">
                        {g.missions.slice(0, 8).map((m) => (
                          <li key={m.mission.id} className="flex items-center justify-between gap-2">
                            <Link to={`/missions/${m.mission.id}`} className="hover:underline truncate">
                              {m.mission.title}
                            </Link>
                            <StatusBadge status={m.status} />
                          </li>
                        ))}
                        {g.missions.length > 8 && <li className="muted">and {g.missions.length - 8} more</li>}
                        {g.missions.length === 0 && <li className="muted">No mission yet; the labs are available.</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <div className="label">Interview focus for this role</div>
            <ul className="list-disc pl-5 text-sm">
              {role.interviewFocus.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <Callout kind="warn">{role.disclaimer}</Callout>
        </Panel>
      )}

      {lens === "tracks" && (
        <>
          <Panel title="Career stages (game levels, not credentials)">
            <ol className="flex flex-wrap gap-2 text-xs">
              {STAGES.map((s) => (
                <li key={s.stage} className={`panel-2 px-2 py-1 ${profile?.stage === s.stage ? "border-amber-500 text-amber-500" : ""}`} title={s.focus}>
                  {s.stage}. {s.title}
                </li>
              ))}
            </ol>
          </Panel>

          {TRACKS.map((t) => {
            const missions = missionsForTrack(t.id);
            const avg = Math.round(t.skills.reduce((a, s) => a + (skills.get(s.id)?.mastery ?? 0), 0) / t.skills.length);
            const done = missions.filter((m) => statuses.get(m.id) === "completed").length;
            const open = openTrack === t.id;
            const lab = TRACK_LAB[t.id];
            return (
              <Panel
                key={t.id}
                title={
                  <button type="button" className="text-left w-full flex items-center justify-between gap-2" aria-expanded={open} onClick={() => setOpenTrack(open ? null : t.id)} data-testid={`track-${t.id}`}>
                    <span>{t.name}</span>
                    <span className="text-xs muted font-normal">
                      {done}/{missions.length} missions · {avg}% mastery {open ? "▴" : "▾"}
                    </span>
                  </button>
                }
              >
                <p className="text-sm muted">{t.summary}</p>
                <div className="mt-2">
                  <ProgressBar value={avg} label="Track mastery (average of demonstrated skills)" />
                </div>
                <p className="text-xs mt-2">
                  <span className="label inline">Role alignment:</span> {role.trackAlignment[t.id]}
                </p>
                {open && (
                  <div className="grid md:grid-cols-2 gap-4 mt-4" data-testid={`track-${t.id}-detail`}>
                    <div>
                      <div className="label">Skills</div>
                      <ul className="text-sm space-y-1">
                        {t.skills.map((s) => {
                          const st = skills.get(s.id);
                          const m = st?.mastery ?? 0;
                          return (
                            <li key={s.id}>
                              <div className="flex items-center justify-between gap-2">
                                <span title={s.description}>{s.name}</span>
                                <span className="text-xs muted">
                                  {m}% · {masteryLabel(m)}
                                </span>
                              </div>
                              {st && (
                                <div className="text-[11px] muted">
                                  {st.independentSolves} independent solve(s) · {st.hintsUsed} hint(s) · {st.evidence.length} evidence item(s) · next review {st.nextReviewAt ? new Date(st.nextReviewAt).toLocaleDateString() : "n/a"}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <Link to={lab.to} className="btn-secondary mt-3 inline-block">
                        Open the {lab.label}
                      </Link>
                    </div>
                    <div>
                      <div className="label">Missions, in order</div>
                      {missions.length === 0 ? (
                        <p className="text-sm muted">Missions for this track are planned (see STATUS.md). The lab is available now.</p>
                      ) : (
                        <ul className="text-sm space-y-1">
                          {missions.map((m) => {
                            const status = statuses.get(m.id) ?? "locked";
                            return (
                              <li key={m.id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <Link to={`/missions/${m.id}`} className="hover:underline">
                                    {m.title}
                                  </Link>
                                  <span className="badge ml-2">{m.kind}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <StatusBadge status={status} />
                                  <Link to={`/missions/${m.id}`} className={status === "locked" ? "btn-ghost text-xs" : "btn-secondary text-xs"}>
                                    {status === "completed" ? "Review" : status === "in-progress" ? "Resume" : status === "locked" ? "View" : "Start"}
                                  </Link>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </Panel>
            );
          })}
        </>
      )}
    </div>
  );
}
