import { useState } from "react";
import { Callout, Panel } from "../ui";
import { nowIso } from "../../data/db";
import { recordScenarioAttempt } from "../../engine/study/store";
import { gradeAnswer, proxyAvailable, type GradeResult } from "../../services/study/grader";
import type { LearnerSettings, StudyScenario, StudyUnitState, StudyVerdict } from "../../domain/types";

interface Props {
  scenario: StudyScenario;
  state: StudyUnitState | undefined;
  settings: LearnerSettings;
}

/**
 * Unit scenario: a situation with numbered sub-tasks. With the proxy
 * configured and consented, the answer is graded per sub-part against the
 * model answers; otherwise the learner checks each sub-part themselves after
 * the model answers are revealed. The verdict is stored on the unit with its
 * source and never changes an objective's status.
 */
export function ScenarioPlayer({ scenario, state, settings }: Props) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState<GradeResult | null>(null);
  const [selfChecks, setSelfChecks] = useState<boolean[]>(() => scenario.subParts.map(() => false));
  const [saved, setSaved] = useState<StudyVerdict | null>(null);
  const proxy = proxyAvailable(settings);
  const attempts = state?.scenarioAttempts ?? [];
  const last = attempts[attempts.length - 1];

  async function submit() {
    setRevealed(true);
    if (!proxy.ok) return;
    setGrading(true);
    const result = await gradeAnswer({ kind: "scenario", prompt: scenario.scenario, answer, modelAnswer: scenario.modelAnswer, subParts: scenario.subParts }, settings);
    setGraded(result);
    setGrading(false);
    if (result.source === "proxy") {
      await recordScenarioAttempt(scenario.unitId, { at: nowIso(), format: "pbq", verdict: result.verdict, source: "proxy" });
      setSaved(result.verdict);
    }
  }

  async function saveSelfCheck() {
    const covered = selfChecks.filter(Boolean).length;
    const verdict: StudyVerdict = covered === scenario.subParts.length ? "correct" : covered > 0 ? "partial" : "incorrect";
    await recordScenarioAttempt(scenario.unitId, { at: nowIso(), format: "pbq", verdict, source: "self" });
    setSaved(verdict);
  }

  return (
    <Panel title={`Scenario: ${scenario.title}`}>
      <p className="text-sm whitespace-pre-wrap" data-testid="scenario-text">{scenario.scenario}</p>
      <ol className="text-xs muted list-decimal pl-5 mt-2">
        {scenario.subParts.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {last && (
        <p className="muted text-xs mt-2" data-testid="scenario-last">
          Last attempt: {last.verdict} ({last.source === "proxy" ? "graded by the proxy" : "self-checked"}) on {last.at.slice(0, 10)}.
        </p>
      )}
      <textarea className="input min-h-32 mt-3" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer every numbered sub-task, in order." data-testid="scenario-input" disabled={revealed} />
      {!revealed ? (
        <button type="button" className="btn-primary mt-2" onClick={() => void submit()} disabled={answer.trim().length < 30} data-testid="scenario-submit">
          {proxy.ok ? "Send to the coaching proxy for grading" : "Compare with the model answers"}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          {grading && <p className="text-sm muted">Grading via the proxy…</p>}
          {graded?.source === "proxy" && (
            <Callout kind={graded.verdict === "correct" ? "success" : graded.verdict === "partial" ? "warn" : "danger"} title={`Proxy verdict: ${graded.verdict}`}>
              <span data-testid="scenario-proxy-feedback">{graded.feedback}</span>
              {graded.missedPoints.length > 0 && <p className="mt-1">Missed: {graded.missedPoints.join("; ")}</p>}
              <p className="muted text-xs mt-1">Graded by a language model against the model answers; it can misjudge.</p>
            </Callout>
          )}
          {!grading && graded?.source !== "proxy" && (
            <>
              {(graded?.source === "self" || !proxy.ok) && <p className="muted text-xs" data-testid="scenario-self-note">{graded?.source === "self" ? graded.reason : !proxy.ok ? proxy.reason : ""}</p>}
              <div className="space-y-2" data-testid="scenario-key">
                {scenario.subParts.map((s, i) => (
                  <label key={s} className="panel-2 p-2 flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={selfChecks[i]} disabled={saved !== null} onChange={(e) => setSelfChecks((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))} data-testid={`scenario-check-${i + 1}`} />
                    <span>
                      <strong>
                        {i + 1}. {s}
                      </strong>
                      <span className="block muted">Model answer: {scenario.modelAnswer[i]}</span>
                      <span className="block text-xs">Tick if your answer covered this.</span>
                    </span>
                  </label>
                ))}
              </div>
              {saved === null ? (
                <button type="button" className="btn-primary" onClick={() => void saveSelfCheck()} data-testid="scenario-save">
                  Save my self-check
                </button>
              ) : (
                <p className="text-sm" data-testid="scenario-saved">
                  Saved as <strong>{saved}</strong> (self-checked). Self-checks are a record for you; only proxy-graded answers count toward Transfer-ready on the objectives.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
