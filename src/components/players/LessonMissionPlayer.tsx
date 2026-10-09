import { useState } from "react";
import type { CheckResult, LessonMission, MissionProgress } from "../../domain/types";
import { recordAttempt, saveMissionState } from "../../engine/missions/engine";
import { MissionFrame } from "./MissionFrame";
import { Callout, Markdown, Panel } from "../ui";

interface Props {
  mission: LessonMission;
  progress: MissionProgress | undefined;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  retention?: boolean;
  onGiveUp?: () => void;
}

/**
 * Lesson mission: the lesson is shown inline (it is the work), followed by a
 * scenario and a check quiz. Each quiz item is a check; wrong answers show
 * the explanation only after an answer, so the quiz still teaches.
 */
export function LessonMissionPlayer({ mission, progress, completed, onComplete, onReset, retention, onGiveUp }: Props) {
  const saved = (progress?.savedState as { answers?: Record<string, number> } | undefined)?.answers ?? {};
  const [answers, setAnswers] = useState<Record<string, number>>(saved);
  const checks: CheckResult[] = mission.quiz.map((q) => ({ id: q.id, label: q.prompt, passed: answers[q.id] === q.correctIndex, detail: answers[q.id] === undefined ? "not answered" : answers[q.id] === q.correctIndex ? undefined : "not quite; re-read the lesson" }));

  const answer = (id: string, index: number) => {
    const next = { ...answers, [id]: index };
    setAnswers(next);
    void saveMissionState(mission.id, { answers: next });
    void recordAttempt(mission.id, mission.quiz.filter((q) => next[q.id] === q.correctIndex).length / mission.quiz.length);
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
        setAnswers({});
        onReset();
      }}
      workstation={
        <div className="space-y-4">
          <Panel title="Lesson">
            <div className="space-y-4">
              {mission.lesson.map((b) => (
                <section key={b.title}>
                  <h3 className="font-semibold mb-1">{b.title}</h3>
                  <Markdown text={b.body} />
                </section>
              ))}
            </div>
          </Panel>
          <Panel title="Scenario">
            <p className="text-sm">{mission.scenario}</p>
          </Panel>
          <Panel title="Check yourself">
            <ol className="space-y-4">
              {mission.quiz.map((q, i) => {
                const a = answers[q.id];
                return (
                  <li key={q.id}>
                    <fieldset className="text-sm">
                      <legend className="font-medium mb-1">
                        {i + 1}. {q.prompt}
                      </legend>
                      <div className="space-y-1">
                        {q.options.map((o, oi) => (
                          <label key={oi} className={`flex items-start gap-2 rounded-md border px-2 py-1.5 cursor-pointer ${a === oi ? (oi === q.correctIndex ? "border-emerald-500" : "border-red-500") : ""}`} style={{ borderColor: a === oi ? undefined : "var(--border)" }}>
                            <input type="radio" name={`quiz-${q.id}`} checked={a === oi} disabled={completed} onChange={() => answer(q.id, oi)} data-testid={`quiz-${q.id}-${oi}`} />
                            <span>{o}</span>
                          </label>
                        ))}
                      </div>
                      {a !== undefined && <p className={`text-xs mt-1 ${a === q.correctIndex ? "text-emerald-400" : "text-red-400"}`}>{a === q.correctIndex ? `Correct. ${q.explanation}` : "Not quite. Re-read the lesson section this question comes from and try again."}</p>}
                    </fieldset>
                  </li>
                );
              })}
            </ol>
          </Panel>
          <Callout kind="info" title="In the interview">
            {mission.interviewCue}
          </Callout>
        </div>
      }
    />
  );
}
