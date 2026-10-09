import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MISSION_BY_ID, RECOMMENDED_ORDER } from "../content/missions";
import { useMissionStatuses, useProfile } from "../data/hooks";
import { completeMission, completeRetentionCheck, redoMission, resetMission, startMission, startRetentionCheck } from "../engine/missions/engine";
import { eligibleStage } from "../engine/learner/mastery";
import { db, logActivity, updateProfile } from "../data/db";
import { TerminalMissionPlayer } from "../components/players/TerminalMissionPlayer";
import { CodeMissionPlayer } from "../components/players/CodeMissionPlayer";
import { BigOMissionPlayer } from "../components/players/BigOMissionPlayer";
import { IncidentPlayer } from "../components/players/IncidentPlayer";
import { DesignMissionPlayer } from "../components/players/DesignMissionPlayer";
import { LessonMissionPlayer } from "../components/players/LessonMissionPlayer";
import { Callout, EmptyState } from "../components/ui";
import { objectivesCreditedBy } from "../engine/study/bridge";

export function MissionPage() {
  const { missionId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const mission = MISSION_BY_ID.get(missionId);
  const { statuses, progress } = useMissionStatuses();
  const profile = useProfile();
  const [started, setStarted] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [retentionResult, setRetentionResult] = useState<"passed" | "failed" | null>(null);
  const retentionStarting = useRef(false);
  const status = statuses.get(missionId) ?? "locked";
  const p = progress.get(missionId);
  const retentionRequested = params.get("retention") === "1";
  const fromObjective = params.get("from");
  const fromUnitPath = fromObjective && /^[a-z0-9-]+:\d+:\d+$/.test(fromObjective) ? `/study/${fromObjective.split(":")[0]}/${fromObjective.split(":")[1]}` : null;
  const credited = objectivesCreditedBy(missionId);
  const retentionActive = retentionRequested && status === "completed" && Boolean(p?.retention);

  useEffect(() => {
    if (mission && status !== "locked" && !started) {
      void startMission(mission.id).then(() => setStarted(true));
    }
  }, [mission, status, started]);

  // Begin a retention check when requested on a completed mission (fresh environment, hints off).
  useEffect(() => {
    if (!mission || !retentionRequested || status !== "completed" || p?.retention || retentionResult || retentionStarting.current) return;
    retentionStarting.current = true;
    void startRetentionCheck(mission.id).finally(() => {
      retentionStarting.current = false;
    });
  }, [mission, retentionRequested, status, p?.retention, retentionResult]);

  if (!mission) return <EmptyState title="Mission not found" body="This mission id does not exist." cta={{ to: "/missions", label: "Back to missions" }} />;

  if (status === "locked") {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">{mission.title}</h1>
        {fromUnitPath && (
          <Callout kind="info" title="From Study">
            This mission is still locked by its prerequisites; finishing it later credits the Study objective you came from. <Link to={fromUnitPath} className="underline" data-testid="study-back-link">Back to the unit</Link>.
          </Callout>
        )}
        <Callout kind="warn" title="Locked">
          Complete the prerequisite mission(s) first: {mission.prerequisites.map((id) => (
            <Link key={id} to={`/missions/${id}`} className="underline mr-2">
              {MISSION_BY_ID.get(id)?.title ?? id}
            </Link>
          ))}
        </Callout>
        <p className="text-sm muted">{mission.summary}</p>
      </div>
    );
  }

  if (!started && !p) return <div className="muted text-sm">Loading mission...</div>;
  if (retentionRequested && status === "completed" && !p?.retention && !retentionResult) return <div className="muted text-sm">Preparing a fresh environment for the retention check...</div>;

  const minutesSpent = () => Math.min(90, Math.max(1, Math.round((Date.now() - startedAt) / 60000)));

  const onComplete = async () => {
    await completeMission(mission, minutesSpent());
    const skills = new Map((await db.skills.toArray()).map((s) => [s.skillId, s]));
    const stage = eligibleStage(skills);
    if (profile && stage > profile.stage) {
      await updateProfile({ stage });
      await logActivity({ type: "stage-promotion", detail: `Promoted to stage ${stage}` });
    }
  };
  const onReset = async () => {
    await resetMission(mission.id);
    await startMission(mission.id);
    setResetKey((k) => k + 1);
  };
  const onRedo = async () => {
    await redoMission(mission.id);
    setResetKey((k) => k + 1);
  };
  const finishRetention = async (passed: boolean) => {
    await completeRetentionCheck(mission, passed, minutesSpent());
    setRetentionResult(passed ? "passed" : "failed");
    setParams({}, { replace: true });
    setResetKey((k) => k + 1);
  };
  const restartRetention = async () => {
    await startRetentionCheck(mission.id);
    setResetKey((k) => k + 1);
  };

  const nextMission = (() => {
    const i = RECOMMENDED_ORDER.indexOf(mission.id);
    for (const id of [...RECOMMENDED_ORDER.slice(i + 1), ...RECOMMENDED_ORDER.slice(0, Math.max(0, i))]) {
      const st = statuses.get(id);
      if (st === "available" || st === "in-progress") return MISSION_BY_ID.get(id) ?? null;
    }
    return null;
  })();

  const common = retentionActive
    ? { progress: p, completed: false, onComplete: () => void finishRetention(true), onReset: () => void restartRetention(), retention: true, onGiveUp: () => void finishRetention(false) }
    : { progress: p, completed: status === "completed", onComplete: () => void onComplete(), onReset: () => void onReset(), onRedo: () => void onRedo() };
  const key = `${mission.id}-${resetKey}-${retentionActive ? "retention" : "normal"}`;

  const player = (() => {
    switch (mission.kind) {
      case "terminal":
      case "investigation":
        return <TerminalMissionPlayer key={key} mission={mission} {...common} />;
      case "python":
      case "go":
        return <CodeMissionPlayer key={key} mission={mission} {...common} />;
      case "bigo":
        return <BigOMissionPlayer key={key} mission={mission} {...common} />;
      case "incident":
        return <IncidentPlayer key={key} mission={mission} {...common} />;
      case "design":
        return <DesignMissionPlayer key={key} mission={mission} {...common} />;
      case "lesson":
        return <LessonMissionPlayer key={key} mission={mission} {...common} />;
    }
  })();

  return (
    <div className="space-y-4">
      {retentionResult === "passed" && (
        <Callout kind="success" title="Retention check passed">
          You recalled this without hints. Mastery for {mission.skills.length} skill(s) increased and the next review is further out. <Link to="/progress" className="underline">See Progress</Link>.
        </Callout>
      )}
      {retentionResult === "failed" && (
        <Callout kind="warn" title="Retention check ended: remediation scheduled">
          No problem. Mastery dipped slightly and a review is scheduled for tomorrow. The lesson and hints are available again below; work through the mission once more at your own pace.
        </Callout>
      )}
      {fromUnitPath && (
        <Callout kind="info" title="From Study">
          Finishing this mission credits the Study objective you came from (to "Guided"). <Link to={fromUnitPath} className="underline" data-testid="study-back-link">Back to the unit</Link>.
        </Callout>
      )}
      {!fromUnitPath && credited.length > 0 && status !== "completed" && (
        <p className="muted text-xs" data-testid="study-credit-note">
          Also counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.
        </p>
      )}
      {p?.redoCount && status !== "completed" && !retentionActive ? (
        <Callout kind="info" title="Redo in progress">
          You completed this mission before, so this run is practice: hints are available, nothing is scored, and finishing it again changes no mastery. Your first completion, reflections and retention history are kept.
        </Callout>
      ) : null}
      {player}
      {status === "completed" && !retentionActive && (
        <Callout kind="info" title="What next">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {nextMission ? (
              <Link to={`/missions/${nextMission.id}`} className="btn-primary" data-testid="next-mission">
                Next mission: {nextMission.title} →
              </Link>
            ) : (
              <span>Every mission you can start right now is done.</span>
            )}
            <Link to="/curriculum" className="btn-secondary">
              Curriculum
            </Link>
            <Link to="/interview/practice" className="btn-secondary">
              Practise explaining it
            </Link>
          </div>
        </Callout>
      )}
    </div>
  );
}
