import { useState } from "react";
import type { BigOMission, CheckResult, ComplexityClass, MissionProgress } from "../../domain/types";
import { COMPLEXITY_ORDER, type AlgorithmKey } from "../../engine/bigo/algorithms";
import { recordAttempt, saveMissionState } from "../../engine/missions/engine";
import { BigOVisualizer, type ExperimentRecord } from "../BigOVisualizer";
import { MissionFrame } from "./MissionFrame";
import { Panel } from "../ui";
import { logActivity } from "../../data/db";

interface Props {
  mission: BigOMission;
  progress: MissionProgress | undefined;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  retention?: boolean;
  onGiveUp?: () => void;
  onRedo?: () => void;
}

interface SavedState {
  experiments: ExperimentRecord[];
  predictions: Record<string, ComplexityClass>;
}

export function BigOMissionPlayer({ mission, progress, completed, onComplete, onReset, retention, onGiveUp, onRedo }: Props) {
  const saved = (progress?.savedState as SavedState | undefined) ?? { experiments: [], predictions: {} };
  const [experiments, setExperiments] = useState<ExperimentRecord[]>(saved.experiments);
  const [predictions, setPredictions] = useState<Record<string, ComplexityClass>>(saved.predictions);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const persist = (e: ExperimentRecord[], p: Record<string, ComplexityClass>) => void saveMissionState(mission.id, { experiments: e, predictions: p } satisfies SavedState);

  const checks: CheckResult[] = mission.tasks.map((t) => {
    if (t.type === "experiment") {
      const ok = t.algorithms.every((a) => experiments.some((e) => e.key === a && e.n >= (t.minInputSize ?? 1)));
      return { id: t.id, label: t.label, passed: ok, detail: ok ? undefined : `Run ${t.algorithms.join(" and ")} with n ≥ ${(t.minInputSize ?? 1).toLocaleString()}` };
    }
    if (t.type === "compare") {
      const ns = t.algorithms.map((a) => new Set(experiments.filter((e) => e.key === a).map((e) => e.n)));
      const common = [...ns[0]].some((n) => ns.every((s) => s.has(n)));
      return { id: t.id, label: t.label, passed: common, detail: common ? undefined : "Run both algorithms at the same n" };
    }
    return { id: t.id, label: t.label, passed: predictions[t.id] === t.expected };
  });

  const highlight = [...new Set(mission.tasks.flatMap((t) => t.algorithms))] as AlgorithmKey[];

  return (
    <MissionFrame
      mission={mission}
      progress={progress}
      retention={retention}
      onGiveUp={onGiveUp}
      onRedo={onRedo}
      checks={checks}
      completed={completed}
      onComplete={onComplete}
      onReset={() => {
        setExperiments([]);
        setPredictions({});
        onReset();
      }}
      workstation={
        <div className="space-y-4">
          <Panel title="Algorithms lab" actions={<span className="text-xs muted">★ = used by this mission</span>}>
            <BigOVisualizer
              highlight={highlight}
              onExperiment={(r) => {
                const next = [...experiments, r].slice(-50);
                setExperiments(next);
                persist(next, predictions);
                void logActivity({ type: "bigo-experiment", missionId: mission.id, minutes: 1, detail: `${r.key} n=${r.n}` });
              }}
            />
          </Panel>
          <Panel title="Tasks">
            <ol className="space-y-3">
              {mission.tasks.map((t, i) => (
                <li key={t.id} className="panel-2 p-3">
                  <div className="text-sm font-medium">
                    {i + 1}. {t.prompt}
                  </div>
                  {t.type === "predict" && (
                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                      {COMPLEXITY_ORDER.map((c) => (
                        <button
                          key={c}
                          type="button"
                          disabled={completed}
                          className={`badge ${predictions[t.id] === c ? (c === t.expected ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400") : ""}`}
                          onClick={() => {
                            const next = { ...predictions, [t.id]: c };
                            setPredictions(next);
                            persist(experiments, next);
                            setRevealed((r) => ({ ...r, [t.id]: true }));
                            void recordAttempt(mission.id, checks.filter((x) => x.passed).length / checks.length);
                          }}
                          data-testid={`predict-${t.id}-${c}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  {(revealed[t.id] || checks.find((c) => c.id === t.id)?.passed) && (
                    <div className={`text-xs mt-2 ${checks.find((c) => c.id === t.id)?.passed ? "text-emerald-400" : "muted"}`}>
                      {checks.find((c) => c.id === t.id)?.passed ? "Correct. " : t.type === "predict" ? "Not yet. Run the algorithm and compare counts at two sizes. " : ""}
                      {t.explanation}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      }
    />
  );
}
