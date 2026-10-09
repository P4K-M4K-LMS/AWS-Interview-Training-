import { useCallback, useMemo, useState } from "react";
import type { CheckResult, InvestigationMission, MissionProgress, TerminalMission } from "../../domain/types";
import { Shell, type ShellSnapshot } from "../../engine/terminal/shell";
import { runTerminalChecks, saveMissionState } from "../../engine/missions/engine";
import { simulatePipelineRun } from "../../content/missions/devops";
import { Terminal } from "../Terminal";
import { FileEditor } from "../FileEditor";
import { MissionFrame } from "./MissionFrame";
import { Panel } from "../ui";
import { logActivity } from "../../data/db";

interface Props {
  mission: TerminalMission | InvestigationMission;
  progress: MissionProgress | undefined;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
}

export function TerminalMissionPlayer({ mission, progress, completed, onComplete, onReset }: Props) {
  const [shell] = useState(() => {
    const saved = progress?.savedState as { shell?: ShellSnapshot } | undefined;
    return new Shell(mission.world, {}, saved?.shell);
  });
  const [checks, setChecks] = useState<CheckResult[]>(() => runTerminalChecks(mission, shell.checkContext()));
  const [editing, setEditing] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>(() => ((progress?.savedState as { answers?: Record<string, number> } | undefined)?.answers ?? {}));
  const [commandCount, setCommandCount] = useState(0);

  const refresh = useCallback(() => {
    if (mission.id === "devops-01-broken-pipeline") {
      simulatePipelineRun((p) => shell.readFile(p), (p, c) => shell.writeFile(p, c, true), (p) => shell.checkContext().mode(p));
    }
    setChecks(runTerminalChecks(mission, shell.checkContext()));
    void saveMissionState(mission.id, { shell: shell.snapshot(), answers });
  }, [mission, shell, answers]);

  const onCommand = useCallback(() => {
    setCommandCount((c) => c + 1);
    if (commandCount % 5 === 0) void logActivity({ type: "terminal-command", missionId: mission.id, minutes: 1 });
    refresh();
  }, [refresh, commandCount, mission.id]);

  const questions = useMemo(() => (mission.kind === "investigation" ? mission.steps.filter((s) => s.question) : []), [mission]);
  const questionChecks: CheckResult[] = questions.map((s) => ({
    id: `q-${s.id}`,
    label: `Question: ${s.question!.prompt}`,
    passed: answers[s.id] === s.question!.correctIndex,
  }));
  const allChecks = [...checks, ...questionChecks];

  const extra =
    questions.length > 0 ? (
      <div className="mt-3 space-y-3">
        {questions.map((s) => {
          const q = s.question!;
          const answered = answers[s.id];
          return (
            <fieldset key={s.id} className="panel-2 p-2">
              <legend className="text-xs font-semibold px-1">{q.prompt}</legend>
              <div className="space-y-1 mt-1">
                {q.options.map((o, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name={`q-${s.id}`}
                      checked={answered === i}
                      disabled={completed}
                      onChange={() => {
                        const next = { ...answers, [s.id]: i };
                        setAnswers(next);
                        void saveMissionState(mission.id, { shell: shell.snapshot(), answers: next });
                      }}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
              {answered !== undefined && <div className={`text-xs mt-1 ${answered === q.correctIndex ? "text-emerald-400" : "text-red-400"}`}>{answered === q.correctIndex ? "Correct. " : "Not quite. "}{q.explanation}</div>}
            </fieldset>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <MissionFrame
        mission={mission}
        progress={progress}
        checks={allChecks}
        completed={completed}
        onComplete={onComplete}
        onReset={onReset}
        extra={extra}
        workstation={
          <Panel title={`Terminal: ${mission.world.user}@${mission.world.hostname}`} actions={<span className="text-xs muted">Commands introduced: {mission.commandsIntroduced.join(", ")}</span>}>
            <Terminal shell={shell} onCommand={onCommand} onEdit={(p) => setEditing(p)} />
            {mission.kind === "investigation" && (
              <ol className="mt-3 text-sm space-y-1">
                {mission.steps.map((s, i) => (
                  <li key={s.id} className="flex gap-2">
                    <span className="muted">{i + 1}.</span>
                    <span>{s.prompt}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        }
      />
      {editing && <FileEditor shell={shell} path={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </>
  );
}
