import { Link } from "react-router-dom";
import { STAGES } from "../content/curriculum";
import { useActivity, useMissionStatuses, useProfile, useSessions, useStudyDays, useStudyStates } from "../data/hooks";
import { STUDY_STATUS_LABELS, dueStudyReviews, isMastered } from "../engine/study/mastery";
import type { StudyStatus } from "../domain/types";
import { dueForReview, stageProgress } from "../engine/learner/mastery";
import { MISSION_BY_ID } from "../content/missions";
import { Callout, PageHeader, Panel, ProgressBar } from "../components/ui";

export function SkillProgressPage() {
  const profile = useProfile();
  const { skills, progress } = useMissionStatuses();
  const sessions = useSessions();
  const days = useStudyDays();
  const activity = useActivity(200);
  const studyStates = useStudyStates();
  if (!profile) return null;
  const sp = stageProgress(profile.stage, skills);
  const due = dueForReview(skills.values());
  const studyDue = dueStudyReviews(studyStates.values());
  const totalMinutes = days.reduce((a, d) => a + d.minutes, 0);
  const hints = activity.filter((a) => a.type === "hint").length;
  const fails = activity.filter((a) => a.type === "mission-fail").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Progress" subtitle="Mastery reflects demonstrated ability: mission completions, independent solves and retention checks. Time spent is tracked but never counts as mastery." />
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

      {studyStates.size > 0 && (
        <Panel title="Study (objective catalog)">
          <p className="muted text-xs mb-2">Separate from skill mastery: objective status follows Ascendra's 0–4 rubric and is credited from missions, never the other way round.</p>
          <ul className="text-sm space-y-1" data-testid="study-progress">
            {[...new Set([...studyStates.values()].map((s) => s.courseId))].sort().map((courseId) => {
              const rows = [...studyStates.values()].filter((s) => s.courseId === courseId);
              const byStatus = new Map<StudyStatus, number>();
              for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
              return (
                <li key={courseId} className="flex flex-wrap gap-x-3">
                  <Link to={`/study/${courseId}`} className="font-medium hover:underline">{courseId}</Link>
                  <span className="muted">{rows.filter((r) => isMastered(r.status)).length} mastered of {rows.length} started</span>
                  <span className="muted">{[...byStatus.entries()].map(([st, n]) => `${STUDY_STATUS_LABELS[st]} ${n}`).join(", ")}</span>
                </li>
              );
            })}
          </ul>
          {studyDue.length > 0 && (
            <p className="text-sm mt-2">
              {studyDue.length} review{studyDue.length === 1 ? "" : "s"} due: <Link to={`/study/${studyDue[0].courseId}/${studyDue[0].unitId.split(":")[1]}`} className="underline">open the first</Link>.
            </p>
          )}
        </Panel>
      )}
      <Panel title="Recent activity">
        {activity.length === 0 ? (
          <p className="text-sm muted">Nothing yet. Start your first mission.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {activity.slice(0, 12).map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="muted text-xs w-36 shrink-0">{new Date(a.at).toLocaleString()}</span>
                <span>
                  {a.type.replace("-", " ")}
                  {a.missionId ? ` · ${a.missionId}` : ""}
                  {a.detail ? ` · ${a.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Callout kind="info" title="Mastery per skill">
        Skill-by-skill mastery, evidence and review dates live in the <Link to="/curriculum" className="underline">Curriculum</Link>, next to the missions that build each skill.
      </Callout>
    </div>
  );
}
