import { Link } from "react-router-dom";
import { TRACKS, STAGES } from "../content/curriculum";
import { useActivity, useMissionStatuses, useProfile, useSessions, useStudyDays } from "../data/hooks";
import { dueForReview, masteryLabel, stageProgress } from "../engine/learner/mastery";
import { MISSION_BY_ID } from "../content/missions";
import { Callout, PageHeader, Panel, ProgressBar } from "../components/ui";

export function SkillProgressPage() {
  const profile = useProfile();
  const { skills, progress } = useMissionStatuses();
  const sessions = useSessions();
  const days = useStudyDays();
  const activity = useActivity(200);
  if (!profile) return null;
  const sp = stageProgress(profile.stage, skills);
  const due = dueForReview(skills.values());
  const totalMinutes = days.reduce((a, d) => a + d.minutes, 0);
  const hints = activity.filter((a) => a.type === "hint").length;
  const fails = activity.filter((a) => a.type === "mission-fail").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Skill Progress" subtitle="Mastery reflects demonstrated ability: mission completions, independent solves and retention checks. Time spent is tracked but never counts as mastery." />
      <div className="grid sm:grid-cols-4 gap-3">
        <Panel title="Study time">
          <div className="text-2xl font-bold">{totalMinutes} min</div>
          <div className="text-xs muted">{days.length} day(s) with activity</div>
        </Panel>
        <Panel title="Missions">
          <div className="text-2xl font-bold">{[...progress.values()].filter((p) => p.status === "completed").length}</div>
          <div className="text-xs muted">{fails} failed attempt(s), {hints} hint(s) used</div>
        </Panel>
        <Panel title="Interview sessions">
          <div className="text-2xl font-bold">{sessions.length}</div>
          <div className="text-xs muted">{sessions.filter((s) => s.feedback).length} with feedback</div>
        </Panel>
        <Panel title="Retention checks due">
          <div className="text-2xl font-bold">{due.length}</div>
          <div className="text-xs muted">spaced repetition</div>
        </Panel>
      </div>

      {due.length > 0 && (
        <Callout kind="warn" title="Retention checks due">
          {due.slice(0, 3).map((s) => {
            const m = [...MISSION_BY_ID.values()].find((x) => x.skills.includes(s.skillId) && progress.get(x.id)?.status === "completed");
            return (
              <div key={s.skillId}>
                {s.skillId}: {m ? <Link to={`/missions/${m.id}?retention=1`} className="underline">redo "{m.title}" without hints</Link> : "practise in the labs"}
              </div>
            );
          })}
        </Callout>
      )}

      <Panel title={`Stage ${profile.stage} → ${sp.next ? `Stage ${sp.next.stage}: ${sp.next.title}` : "max"}`}>
        {sp.next ? (
          <div className="space-y-2">
            {sp.items.map((i) => (
              <ProgressBar key={i.skill.id} value={i.mastery} label={`${i.skill.name} (need ${i.required}%)`} color={i.met ? "bg-emerald-500" : "bg-amber-500"} />
            ))}
          </div>
        ) : (
          <p className="text-sm muted">All stages reached.</p>
        )}
        <ol className="mt-3 text-xs muted flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <li key={s.stage} className={s.stage <= profile.stage ? "text-amber-500" : ""}>
              {s.stage}. {s.title}
            </li>
          ))}
        </ol>
      </Panel>

      {TRACKS.map((t) => (
        <Panel key={t.id} title={t.name}>
          <div className="space-y-2">
            {t.skills.map((s) => {
              const st = skills.get(s.id);
              const m = st?.mastery ?? 0;
              return (
                <div key={s.id}>
                  <ProgressBar value={m} label={`${s.name} · ${masteryLabel(m)}`} color={m >= 85 ? "bg-emerald-500" : m >= 60 ? "bg-sky-500" : "bg-amber-500"} />
                  {st && (
                    <div className="text-[11px] muted mt-0.5">
                      {st.independentSolves} independent solve(s) · {st.hintsUsed} hint(s) · {st.evidence.length} evidence item(s) · next review {st.nextReviewAt ? new Date(st.nextReviewAt).toLocaleDateString() : "n/a"}
                      {Object.keys(st.errorPatterns).length > 0 && ` · errors: ${Object.entries(st.errorPatterns).map(([k, v]) => `${k}×${v}`).join(", ")}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
