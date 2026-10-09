import { Link } from "react-router-dom";
import { useActivity, useMissionStatuses, useProfile, useSessions, useStudyDays } from "../data/hooks";
import { recommendNext } from "../engine/learner/recommend";
import { stageProgress } from "../engine/learner/mastery";
import { stageInfo } from "../content/curriculum";
import { MISSIONS } from "../content/missions";
import { roleFor } from "../content/roles";
import { nextMissionForGap, roleGapMap } from "../engine/learner/roleGap";
import { Callout, PageHeader, Panel, ProgressBar } from "../components/ui";
import { localDate } from "../data/db";

export function DashboardPage() {
  const profile = useProfile();
  const { statuses, progress, skills } = useMissionStatuses();
  const activity = useActivity(8);
  const sessions = useSessions();
  const days = useStudyDays();
  if (!profile) return null;

  const role = roleFor(profile.targetRoleId);
  const gap = roleGapMap(role, skills, progress);
  const gapMission = nextMissionForGap(gap);
  const recs = recommendNext(progress, skills);
  const primary = recs[0];
  const stage = stageInfo(profile.stage);
  const sp = stageProgress(profile.stage, skills);
  const completed = [...statuses.values()].filter((s) => s === "completed").length;
  const today = days.find((d) => d.date === localDate());
  const minutesToday = today?.minutes ?? 0;
  const goal = profile.settings.dailyGoalMinutes;
  const streak = computeStreak(days.map((d) => d.date));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome back, ${profile.displayName}`}
        subtitle={`Stage ${stage.stage}: ${stage.title}. ${stage.focus}`}
        actions={
          <Link to={primary.path} className="btn-primary text-base px-5 py-2.5" data-testid="continue-learning">
            Continue Learning →
          </Link>
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        <Panel title="Today's session">
          <ProgressBar value={(minutesToday / goal) * 100} label={`${minutesToday} / ${goal} min`} />
          <ul className="text-xs muted mt-3 space-y-1">
            <li>3 min: recall and review</li>
            <li>7 min: new concept (mission lesson)</li>
            <li>15 min: hands-on mission</li>
            <li>5 min: reflection and feedback</li>
          </ul>
          <div className="text-xs mt-2">
            {streak > 0 ? `${streak}-day streak` : "No study logged today yet"} · no penalties for missed days
          </div>
        </Panel>
        <Panel title="Missions">
          <div className="text-3xl font-bold">
            {completed}
            <span className="text-base muted font-normal"> / {MISSIONS.length} completed</span>
          </div>
          <ProgressBar value={(completed / MISSIONS.length) * 100} />
          <Link to="/missions" className="text-sm accent underline mt-2 inline-block">
            Open Mission Control
          </Link>
        </Panel>
        <Panel title={sp.next ? `Toward Stage ${sp.next.stage}: ${sp.next.title}` : "Final stage reached"}>
          {sp.next ? (
            <>
              <ProgressBar value={sp.pct} label={`${sp.items.filter((i) => i.met).length} / ${sp.items.length} skills at ${sp.next.requiredMastery}%`} />
              <ul className="text-xs mt-2 space-y-0.5">
                {sp.items.slice(0, 4).map((i) => (
                  <li key={i.skill.id} className="flex justify-between">
                    <span className={i.met ? "" : "muted"}>{i.skill.name}</span>
                    <span className="muted">{i.mastery}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm muted">You have reached the last fictional stage.</p>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Recommended next">
          <ol className="space-y-3">
            {recs.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-xs muted mt-1">{i + 1}</span>
                <div className="flex-1">
                  <Link to={r.path} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                  <div className="text-xs muted">{r.reason}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={`Target role: ${role.title}`}>
          <ProgressBar value={gap.trainablePct} label={`${gap.trainablePct}% average mastery across the qualifications OpsForge can train`} />
          {gap.weakest && (
            <p className="text-sm mt-2" data-testid="role-weakest">
              Weakest: <span className="font-medium">{gap.weakest.qualification.text}</span> ({gap.weakest.pct}%).
            </p>
          )}
          {gapMission && (
            <p className="text-sm mt-1">
              Available now for this role:{" "}
              <Link to={`/missions/${gapMission.mission.id}`} className="underline">
                {gapMission.mission.title}
              </Link>{" "}
              <span className="muted">(builds: {gapMission.gap.qualification.text.length > 60 ? gapMission.gap.qualification.text.slice(0, 60) + "…" : gapMission.gap.qualification.text})</span>
            </p>
          )}
          <p className="text-xs muted mt-2">
            {gap.counts["not-addressable"]} qualification(s) cannot be addressed here (degree, tenure, clearance); {gap.counts.planned} are planned.{" "}
            <Link to="/paths" className="underline">
              Full gap map
            </Link>
          </p>
        </Panel>
        <Panel title="Interview readiness">
          <p className="text-sm">
            {sessions.length === 0 ? "No practice sessions yet." : `${sessions.length} practice session(s) saved.`} The Interview Command Center has STAR training, all 16 Leadership Principles, a private story bank, and Dive Deeper Mode.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Link to="/interview/star" className="btn-secondary">
              STAR Academy
            </Link>
            <Link to="/interview/practice" className="btn-secondary">
              Practice a question
            </Link>
          </div>
        </Panel>
      </div>

      <Panel title="Recent activity">
        {activity.length === 0 ? (
          <p className="text-sm muted">Nothing yet. Start your first mission.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {activity.map((a) => (
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

      <Callout kind="info" title="What works today vs what is planned">
        Missions, the terminal simulator, real Python execution, Big O labs, STAR coaching and Dive Deeper Mode are implemented. Voice depends on your browser. See Settings → About for the live feature status.
      </Callout>
    </div>
  );
}

function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = localDate(d);
    if (!set.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
