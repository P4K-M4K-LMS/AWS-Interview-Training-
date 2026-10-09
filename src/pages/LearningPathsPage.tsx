import { Link } from "react-router-dom";
import { POSTING_QUALIFICATIONS, STAGES, TRACKS } from "../content/curriculum";
import { missionsForTrack } from "../content/missions";
import { useMissionStatuses, useProfile } from "../data/hooks";
import { masteryLabel } from "../engine/learner/mastery";
import { Callout, PageHeader, Panel, ProgressBar, StatusBadge } from "../components/ui";

export function LearningPathsPage() {
  const { statuses, skills } = useMissionStatuses();
  const profile = useProfile();
  return (
    <div className="space-y-5">
      <PageHeader title="Learning Paths" subtitle="Six tracks with prerequisites. Mastery comes only from missions, independent solves and retention checks." />
      <Panel title="Target job posting alignment">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="label">Basic qualifications</div>
            <ul className="list-disc pl-5 space-y-1">
              {POSTING_QUALIFICATIONS.basic.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label">Preferred qualifications</div>
            <ul className="list-disc pl-5 space-y-1">
              {POSTING_QUALIFICATIONS.preferred.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
        <Callout kind="warn">{POSTING_QUALIFICATIONS.disclaimer}</Callout>
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
              <span className="label inline">Posting alignment:</span> {t.postingAlignment}
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
