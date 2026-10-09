import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MISSION_BY_ID } from "../content/missions";
import { useMissionStatuses, useProfile } from "../data/hooks";
import { completeMission, resetMission, startMission } from "../engine/missions/engine";
import { eligibleStage } from "../engine/learner/mastery";
import { db, logActivity, updateProfile } from "../data/db";
import { TerminalMissionPlayer } from "../components/players/TerminalMissionPlayer";
import { PythonMissionPlayer } from "../components/players/PythonMissionPlayer";
import { BigOMissionPlayer } from "../components/players/BigOMissionPlayer";
import { Callout, EmptyState } from "../components/ui";

export function MissionPage() {
  const { missionId = "" } = useParams();
  const mission = MISSION_BY_ID.get(missionId);
  const { statuses, progress } = useMissionStatuses();
  const profile = useProfile();
  const [started, setStarted] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const status = statuses.get(missionId) ?? "locked";
  const p = progress.get(missionId);

  useEffect(() => {
    if (mission && status !== "locked" && !started) {
      void startMission(mission.id).then(() => setStarted(true));
    }
  }, [mission, status, started]);

  if (!mission) return <EmptyState title="Mission not found" body="This mission id does not exist." cta={{ to: "/missions", label: "Back to Mission Control" }} />;

  if (status === "locked") {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">{mission.title}</h1>
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

  const onComplete = async () => {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    await completeMission(mission, Math.min(minutes, 90));
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

  const common = { progress: p, completed: status === "completed", onComplete: () => void onComplete(), onReset: () => void onReset() };
  const key = `${mission.id}-${resetKey}`;
  switch (mission.kind) {
    case "terminal":
    case "investigation":
      return <TerminalMissionPlayer key={key} mission={mission} {...common} />;
    case "python":
      return <PythonMissionPlayer key={key} mission={mission} {...common} />;
    case "bigo":
      return <BigOMissionPlayer key={key} mission={mission} {...common} />;
  }
}
