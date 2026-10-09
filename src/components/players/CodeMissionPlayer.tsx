import { useState } from "react";
import type { CheckResult, CodeMission, MissionProgress } from "../../domain/types";
import type { PyRunResult } from "../../engine/python/execute";
import { recordAttempt, saveMissionState } from "../../engine/missions/engine";
import { PythonEditor } from "../PythonEditor";
import { RunOutput, RunnerStatusLine, useCodeRunner } from "../PythonRunPanel";
import { MissionFrame } from "./MissionFrame";
import { Panel } from "../ui";
import { logActivity } from "../../data/db";

interface Props {
  mission: CodeMission;
  progress: MissionProgress | undefined;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  retention?: boolean;
  onGiveUp?: () => void;
}

export function CodeMissionPlayer({ mission, progress, completed, onComplete, onReset, retention, onGiveUp }: Props) {
  const saved = progress?.savedState as { code?: string; lastResult?: PyRunResult } | undefined;
  const [code, setCode] = useState(saved?.code ?? mission.starterCode);
  const [result, setResult] = useState<PyRunResult | null>(saved?.lastResult ?? null);
  const { runner, status, detail } = useCodeRunner(mission.kind);

  const checks: CheckResult[] = mission.tests.map((t) => {
    const r = result?.tests.find((x) => x.id === t.id);
    return { id: t.id, label: t.label, passed: Boolean(r?.passed), detail: r && !r.passed ? r.error?.split("\n").slice(-1)[0] : undefined };
  });

  const run = async (withTests: boolean) => {
    const r = await runner.run({ code, tests: withTests ? mission.tests.map((t) => ({ id: t.id, code: t.code, stdin: t.stdin })) : [] });
    setResult(r);
    void logActivity({ type: "python-run", missionId: mission.id, minutes: 1, detail: r.error ? r.errorType ?? "error" : withTests ? `${r.tests.filter((t) => t.passed).length}/${r.tests.length} tests` : "ok" });
    if (withTests) {
      const score = r.tests.length ? r.tests.filter((t) => t.passed).length / r.tests.length : 0;
      await recordAttempt(mission.id, score);
    }
    await saveMissionState(mission.id, { code, lastResult: r });
  };

  return (
    <MissionFrame
      mission={mission}
      progress={progress}
      retention={retention}
      onGiveUp={onGiveUp}
      checks={checks}
      completed={completed}
      onComplete={onComplete}
      onReset={() => {
        setCode(mission.starterCode);
        setResult(null);
        onReset();
      }}
      workstation={
        <Panel title={mission.kind === "go" ? "Go Laboratory" : "Python Laboratory"} actions={<RunnerStatusLine status={status} detail={detail} version={runner.version} language={mission.kind} />}>
          <PythonEditor language={mission.kind} value={code} onChange={(v) => { setCode(v); void saveMissionState(mission.id, { code: v, lastResult: result }); }} />
          <div className="flex gap-2 mt-3 flex-wrap">
            <button type="button" className="btn-secondary" disabled={status !== "ready"} onClick={() => void run(false)} data-testid="python-run">
              ▶ Run
            </button>
            <button type="button" className="btn-primary" disabled={status !== "ready"} onClick={() => void run(true)} data-testid="python-run-tests">
              ✓ Run tests
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCode(mission.starterCode)}>
              Reset code
            </button>
          </div>
          <div className="mt-3">
            <RunOutput result={result} errorHelp={mission.errorHelp} />
          </div>
        </Panel>
      }
    />
  );
}
