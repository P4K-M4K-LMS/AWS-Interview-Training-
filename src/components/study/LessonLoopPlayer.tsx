import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Callout, Markdown, Panel } from "../ui";
import { MISSION_BY_ID } from "../../content/missions";
import { STUDY_DISCLAIMER } from "../../content/study/disclaimer";
import { ENGINE_BY_ID } from "../../content/study/engines";
import { LAB_LABELS, labExercisePath } from "../../content/study/labs";
import { nowIso } from "../../data/db";
import { STUDY_STATUS_LABELS, statusCap } from "../../engine/study/mastery";
import { pickQuestion, presentQuestion, type Presented } from "../../engine/study/select";
import { recordStudyAttempt } from "../../engine/study/store";
import { gradeAnswer, proxyAvailable, type GradeResult } from "../../services/study/grader";
import type { ExplanationLevel, LearnerSettings, StudyLesson, StudyObjective, StudyObjectiveState } from "../../domain/types";

type Step = "guess" | "teach" | "practice" | "explain" | "summary";

interface Props {
  objective: StudyObjective;
  lesson: StudyLesson;
  state: StudyObjectiveState | undefined;
  level: ExplanationLevel;
  /** Open on the practice step with an unseen question (a due review). */
  review?: boolean;
  generatedBy: { model: string; generatedAt: string };
  /** Coaching settings decide whether the proxy grades the explanation. */
  settings: LearnerSettings;
}

/**
 * The lesson loop: guess from intuition, read the teaching, answer one check
 * question (unseen first), explain it back against the model answer, then a
 * summary. Multiple-choice answers are graded by the answer key; the
 * explanation is rated by the learner (source "self"), which the rubric caps
 * at Independent. Every attempt goes through the Study store, nothing here
 * touches skill mastery.
 */
export function LessonLoopPlayer({ objective, lesson, state, level, review, generatedBy, settings }: Props) {
  const [step, setStep] = useState<Step>(review ? "practice" : "guess");
  const [guess, setGuess] = useState("");
  const [presented, setPresented] = useState<Presented | undefined>(() => (review ? present(lesson, state) : undefined));
  const [picked, setPicked] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<"correct" | "incorrect" | null>(null);
  const [explanation, setExplanation] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [selfRating, setSelfRating] = useState<"correct" | "partial" | "incorrect" | null>(null);
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState<GradeResult | null>(null);
  const proxy = proxyAvailable(settings);
  const [answered, setAnswered] = useState(0);
  const cap = statusCap(objective);
  const mission = objective.link?.kind === "mission" ? MISSION_BY_ID.get(objective.link.missionId) : undefined;
  const engine = objective.modality === "do-new" && objective.link?.kind === "engine" ? ENGINE_BY_ID.get(objective.link.engineId) : undefined;
  const status = state?.status ?? "not-started";
  const plainOpen = useMemo(() => level === "beginner", [level]);

  function startPractice() {
    setPresented(present(lesson, state));
    setPicked(null);
    setVerdict(null);
    setStep("practice");
  }

  async function answer(shownIndex: number) {
    if (!presented || picked !== null) return;
    setPicked(shownIndex);
    const correct = shownIndex === presented.correctShown;
    setVerdict(correct ? "correct" : "incorrect");
    setAnswered((n) => n + 1);
    await recordStudyAttempt(objective.id, { at: nowIso(), format: "mc", verdict: correct ? "correct" : "incorrect", source: "auto", questionId: presented.question.id }, cap);
  }

  async function rateExplanation(v: "correct" | "partial" | "incorrect") {
    setSelfRating(v);
    await recordStudyAttempt(objective.id, { at: nowIso(), format: "open", verdict: v, source: "self" }, cap);
    setStep("summary");
  }

  async function submitExplanation() {
    setRevealed(true);
    if (!proxy.ok) return;
    setGrading(true);
    const result = await gradeAnswer({ kind: "explain", prompt: lesson.explainPrompt, answer: explanation, modelAnswer: lesson.modelAnswer, rubricPoints: lesson.rubricPoints }, settings);
    setGraded(result);
    setGrading(false);
    if (result.source === "proxy") {
      setSelfRating(result.verdict);
      await recordStudyAttempt(objective.id, { at: nowIso(), format: "open", verdict: result.verdict, source: "proxy" }, cap);
    }
  }

  return (
    <div className="space-y-4" data-testid="lesson-loop" data-step={step}>
      <div className="flex flex-wrap gap-2 text-xs" aria-label="Lesson steps">
        {(["guess", "teach", "practice", "explain", "summary"] as Step[]).map((s, i) => (
          <span key={s} className={`badge ${s === step ? "text-amber-500" : "muted"}`}>
            {i + 1}. {s === "guess" ? "Guess" : s === "teach" ? "Read" : s === "practice" ? "Check" : s === "explain" ? "Explain it back" : "Summary"}
          </span>
        ))}
        <span className="badge ml-auto" data-testid="loop-status">
          Status: {STUDY_STATUS_LABELS[status]}
        </span>
      </div>

      {review && step === "practice" && (
        <Callout kind="info" title="Review">
          You missed a question on this objective earlier. Answer a question you have not seen to move the review on (1, 7, then 21 days).
        </Callout>
      )}

      {step === "guess" && (
        <Panel title="Before reading: what is your guess?">
          <p className="text-sm mb-2" data-testid="guess-prompt">{lesson.guessPrompt}</p>
          <textarea className="input min-h-24" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="A sentence or two from intuition. Not graded." data-testid="guess-input" />
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-primary" onClick={() => setStep("teach")} data-testid="guess-submit" disabled={!guess.trim()}>
              Compare with the teaching
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep("teach")} data-testid="guess-skip">
              Just teach me
            </button>
          </div>
        </Panel>
      )}

      {step === "teach" && (
        <>
          {guess.trim() && (
            <Panel title="Your guess">
              <p className="text-sm whitespace-pre-wrap" data-testid="guess-echo">{guess}</p>
              <p className="muted text-xs mt-1">Compare it with the teaching below; nothing here is graded.</p>
            </Panel>
          )}
          {plainOpen ? (
            <section className="panel-2 p-3" data-testid="lesson-plain">
              <div className="label">In plain words</div>
              <Markdown text={lesson.plain} />
            </section>
          ) : (
            <details className="panel-2 p-3" data-testid="lesson-plain-collapsed">
              <summary className="cursor-pointer text-sm font-medium">Start from the basics</summary>
              <div className="mt-2">
                <Markdown text={lesson.plain} />
              </div>
            </details>
          )}
          <Panel title="The teaching">
            <div data-testid="lesson-teach">
              <Markdown text={lesson.teach} />
            </div>
          </Panel>
          {mission && (
            <Callout kind="info" title="Do it, not just read it">
              <Link to={`/missions/${mission.id}?from=${encodeURIComponent(objective.id)}`} className="underline">{mission.title}</Link> makes you do this; finishing it credits the objective.
            </Callout>
          )}
          {objective.link?.kind === "lab" && (
            <Callout kind="info" title="Do it, not just read it">
              <Link to={labExercisePath(objective.link, objective.id)} className="underline">{LAB_LABELS[objective.link.labId] ?? objective.link.labId}</Link> has an exercise for this; passing it credits the objective.
            </Callout>
          )}
          {objective.modality === "do-new" && (
            <Callout kind="warn" title="Hands-on part planned">
              This is best learned by doing{engine ? ` in the ${engine.name.toLowerCase()}` : ""}, which is not built yet. Until it is, this objective stops at "Independent".
            </Callout>
          )}
          <button type="button" className="btn-primary" onClick={startPractice} data-testid="teach-next">
            Check what you took in
          </button>
        </>
      )}

      {step === "practice" && presented && (
        <Panel title={presented.question.role === "fade" ? "Finish the worked example" : "Check question"}>
          <p className="text-sm mb-3" data-testid="question-prompt">{presented.question.prompt}</p>
          <div className="space-y-2" role="group" aria-label="Choices">
            {presented.choices.map((c, i) => {
              const isPicked = picked === i;
              const isCorrect = i === presented.correctShown;
              const tone = picked === null ? "" : isCorrect ? "border-emerald-500" : isPicked ? "border-red-500" : "";
              return (
                <button key={i} type="button" className={`panel-2 w-full text-left p-2 text-sm ${tone}`} onClick={() => void answer(i)} disabled={picked !== null} data-testid={`choice-${i}`} data-correct={isCorrect ? "1" : "0"}>
                  {c}
                </button>
              );
            })}
          </div>
          {verdict && (
            <div className="mt-3 text-sm" data-testid="question-verdict">
              <strong>{verdict === "correct" ? "Correct." : "Not this one."}</strong> {presented.question.why}
              {verdict === "incorrect" && <span className="muted"> A review of this objective is scheduled for tomorrow.</span>}
            </div>
          )}
          {verdict && (
            <div className="flex gap-2 mt-3">
              {answered < lesson.questions.length && (
                <button type="button" className="btn-secondary" onClick={startPractice} data-testid="another-question">
                  Another question
                </button>
              )}
              <button type="button" className="btn-primary" onClick={() => setStep("explain")} data-testid="practice-next">
                Explain it back
              </button>
              {verdict === "incorrect" && (
                <button type="button" className="btn-ghost" onClick={() => setStep("teach")}>
                  Re-read the teaching
                </button>
              )}
            </div>
          )}
        </Panel>
      )}

      {step === "explain" && (
        <Panel title="Explain it back">
          <p className="text-sm mb-2" data-testid="explain-prompt">{lesson.explainPrompt}</p>
          <textarea className="input min-h-32" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Write it as you would say it to a teammate." data-testid="explain-input" disabled={revealed} />
          {!revealed ? (
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn-primary" onClick={() => void submitExplanation()} disabled={explanation.trim().length < 20} data-testid="explain-submit">
                {proxy.ok ? "Send to the coaching proxy for grading" : "Compare with the model answer"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setStep("summary")}>
                Skip
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <section className="panel-2 p-3">
                <div className="label">Model answer</div>
                <p className="text-sm" data-testid="model-answer">{lesson.modelAnswer}</p>
              </section>
              <section className="panel-2 p-3">
                <div className="label">A good answer covers</div>
                <ul className="text-sm list-disc pl-5">
                  {lesson.rubricPoints.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
              {grading && <p className="text-sm muted" data-testid="grading">Grading via the proxy…</p>}
              {graded?.source === "proxy" && (
                <section className="panel-2 p-3" data-testid="proxy-verdict">
                  <div className="label">Proxy verdict: {graded.verdict}</div>
                  <p className="text-sm">{graded.feedback}</p>
                  {graded.missedPoints.length > 0 && <p className="text-sm mt-1">Missing: {graded.missedPoints.join("; ")}</p>}
                  <p className="muted text-xs mt-1">Graded by a language model{graded.model ? ` (${graded.model})` : ""} against the model answer; it can misjudge. Recorded as a proxy-graded answer.</p>
                  <button type="button" className="btn-primary mt-2" onClick={() => setStep("summary")} data-testid="proxy-continue">
                    Continue
                  </button>
                </section>
              )}
              {!grading && graded?.source !== "proxy" && (
                <>
                  <p className="text-sm" data-testid="self-rate-note">
                    {graded?.source === "self" ? graded.reason : proxy.ok ? "" : proxy.reason} Rate your own answer honestly. Self-rated answers reach "Independent" at most; "Transfer-ready" needs the coaching proxy to grade two answers.
                  </p>
                  <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => void rateExplanation("correct")} data-testid="self-correct">
                  Covered the points
                </button>
                <button type="button" className="btn-secondary" onClick={() => void rateExplanation("partial")} data-testid="self-partial">
                  Covered some
                </button>
                <button type="button" className="btn-secondary" onClick={() => void rateExplanation("incorrect")} data-testid="self-incorrect">
                  Missed it
                </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Panel>
      )}

      {step === "summary" && (
        <Panel title="Summary">
          <p className="text-sm" data-testid="summary-status">
            Status now: <strong>{STUDY_STATUS_LABELS[status]}</strong>.{" "}
            {graded?.source === "proxy" ? `The proxy graded your explanation as ${graded.verdict}.` : selfRating === "correct" ? "You explained it back and rated it as covering the points." : selfRating ? "You rated your explanation honestly; come back after a review." : "You skipped the explanation; it is what takes an objective past Guided."}
            {cap === "independent" && " This objective caps at Independent until its lab exists."}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn-secondary" onClick={startPractice} data-testid="summary-practice">
              Another check question
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep("teach")}>
              Re-read
            </button>
          </div>
        </Panel>
      )}

      <p className="muted text-xs">
        Written by {generatedBy.model} on {generatedBy.generatedAt.slice(0, 10)}, checked by a validator and spot-checked by the owner, not by any vendor. {STUDY_DISCLAIMER}
      </p>
    </div>
  );
}

function present(lesson: StudyLesson, state: StudyObjectiveState | undefined): Presented | undefined {
  const q = pickQuestion(lesson.questions, state);
  return q ? presentQuestion(q) : undefined;
}
