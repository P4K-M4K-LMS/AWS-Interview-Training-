import { Link } from "react-router-dom";
import { STAGES, TRACKS } from "../content/curriculum";
import { missionsForTrack } from "../content/missions";
import { COVERAGE_LABELS, ROLES, roleFor } from "../content/roles";
import { useMissionStatuses, useProfile } from "../data/hooks";
import { updateProfile } from "../data/db";
import { masteryLabel } from "../engine/learner/mastery";
import { roleGapMap } from "../engine/learner/roleGap";
import { Callout, PageHeader, Panel, ProgressBar, StatusBadge } from "../components/ui";

export function LearningPathsPage() {
  const { statuses, progress, skills } = useMissionStatuses();
  const profile = useProfile();
  const role = roleFor(profile?.targetRoleId);
  const gap = roleGapMap(role, skills, progress);
  return (
    <div className="space-y-5">
      <PageHeader title="Learning Paths" subtitle="Six tracks with prerequisites. Mastery comes only from missions, independent solves and retention checks." />
      <Panel
        title="Target role: qualification gap map"
        actions={
          <label className="text-xs flex items-center gap-2">
            <span className="muted">Target role</span>
            <select className="input text-xs py-1" value={role.id} onChange={(e) => void updateProfile({ targetRoleId: e.target.value as typeof role.id })} data-testid="role-select" aria-label="Target role">
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        }
      >
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

      <Panel title="Career progression (game levels, not credentials)">
        <ol className="grid md:grid-cols-3 gap-2 text-sm">
          {STAGES.map((s) => (
            <li key={s.stage} className={`panel-2 p-3 ${profile?.stage === s.stage ? "border-amber-500" : ""}`}>
              <div className="font-semibold">
                {s.stage}. {s.title}
              </div>
              <div className="muted text-xs">{s.focus}</div>
            </li>
          ))}
        </ol>
      </Panel>

      {TRACKS.map((t) => {
        const missions = missionsForTrack(t.id);
        const avg = Math.round(t.skills.reduce((a, s) => a + (skills.get(s.id)?.mastery ?? 0), 0) / t.skills.length);
        return (
          <Panel key={t.id} title={t.name}>
            <p className="text-sm muted">{t.summary}</p>
            <p className="text-xs mt-1">
              <span className="label inline">Role alignment:</span> {role.trackAlignment[t.id]}
            </p>
            <div className="mt-3">
              <ProgressBar value={avg} label="Track mastery (average of demonstrated skills)" />
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <div className="label">Skills</div>
                <ul className="text-sm space-y-1">
                  {t.skills.map((s) => {
                    const m = skills.get(s.id)?.mastery ?? 0;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-2">
                        <span title={s.description}>{s.name}</span>
                        <span className="text-xs muted">
                          {m}% · {masteryLabel(m)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="label">Missions</div>
                {missions.length === 0 ? (
                  <p className="text-sm muted">Missions for this track are planned (see STATUS.md). The labs are available now.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {missions.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2">
                        <Link to={`/missions/${m.id}`} className="hover:underline">
                          {m.title}
                        </Link>
                        <StatusBadge status={statuses.get(m.id) ?? "locked"} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
