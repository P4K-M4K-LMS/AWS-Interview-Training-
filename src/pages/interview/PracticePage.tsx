import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, logActivity, nowIso, uid } from "../../data/db";
import { useProfile, useStories } from "../../data/hooks";
import { GENERAL_QUESTIONS, LEADERSHIP_PRINCIPLES, LP_BY_ID } from "../../content/leadershipPrinciples";
import { SCHEMA_VERSION, type DeliveryObservations, type FeedbackReport, type InterviewMode, type InterviewQuestion, type InterviewSession, type InterviewTurn, type LeadershipPrincipleId } from "../../domain/types";
import { applyFollowUpAnswer, createDiveDeeperState, nextFollowUp, stopDiveDeeper } from "../../engine/interview/diveDeeper";
import { compareFeedback } from "../../engine/interview/scoring";
import { GAP_LABELS } from "../../engine/interview/star";
import { getFeedback } from "../../services/coach";
import { speak, stopSpeaking, canSpeak } from "../../services/voice/synthesis";
import { VoiceInput } from "../../components/VoiceInput";
import { Callout, PageHeader, Panel, ProgressBar } from "../../components/ui";

const ALL_QUESTIONS: InterviewQuestion[] = [...GENERAL_QUESTIONS, ...LEADERSHIP_PRINCIPLES.flatMap((p) => p.questions)];
const TECH_FOLLOWUPS = [
  "Walk me through how you would investigate a Linux service that fails to start after a deploy.",
  "How would you find the most frequent error in a large log file from the command line?",
  "Explain Big O to someone who has never heard of it, then give an O(n²) example from real code.",
  "What is the difference between authentication and authorization? Give an example of least privilege.",
  "A pipeline is red. What is your first step, and what would you never do to make it green?",
];

export function PracticePage() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const stories = useStories();
  const existing = useLiveQuery(() => (sessionId ? db.sessions.get(sessionId) : undefined), [sessionId]);

  const [mode, setMode] = useState<InterviewMode>((params.get("mode") as InterviewMode) || "practice");
  const [principleId, setPrincipleId] = useState<LeadershipPrincipleId | "">("");
  const [questionId, setQuestionId] = useState<string>(params.get("question") ?? "");
  const [customQuestion, setCustomQuestion] = useState<string>(params.get("question") && !ALL_QUESTIONS.some((q) => q.id === params.get("question")) ? params.get("question")! : "");
  const [storyId, setStoryId] = useState<string>(params.get("story") ?? "");
  const [timeLimit, setTimeLimit] = useState(10);

  useEffect(() => {
    const q = ALL_QUESTIONS.find((x) => x.id === params.get("question"));
    if (q?.principleId) setPrincipleId(q.principleId);
  }, [params]);

  if (sessionId) {
    if (existing === undefined) return <div className="muted text-sm">Loading session...</div>;
    if (!existing) return <Callout kind="danger">Session not found.</Callout>;
    return <SessionRunner session={existing} />;
  }
  if (!profile) return null;

  const questions = principleId ? (LP_BY_ID.get(principleId)?.questions ?? []) : GENERAL_QUESTIONS;

  const start = async () => {
    const q = ALL_QUESTIONS.find((x) => x.id === questionId);
    const text = customQuestion.trim() || q?.text || questions[0]?.text || GENERAL_QUESTIONS[0].text;
    const pid = (q?.principleId ?? principleId) || null;
    const id = uid("session");
    const realistic =
      mode === "realistic"
        ? {
            questionIds: pickRealistic(pid),
            timeLimitSec: timeLimit * 60,
            currentIndex: 0,
          }
        : undefined;
    const firstText = realistic ? ALL_QUESTIONS.find((x) => x.id === realistic.questionIds[0])!.text : text;
    const session: InterviewSession = {
      id,
      schemaVersion: SCHEMA_VERSION,
      mode,
      startedAt: nowIso(),
      endedAt: null,
      questionId: realistic ? realistic.questionIds[0] : (q?.id ?? "custom"),
      questionText: firstText,
      principleId: realistic ? (ALL_QUESTIONS.find((x) => x.id === realistic.questionIds[0])?.principleId ?? null) : pid,
      storyId: storyId || null,
      inputMode: "text",
      turns: [{ id: uid("turn"), at: nowIso(), role: "interviewer", text: firstText }],
      diveDeeper: null,
      feedback: null,
      revisedAnswer: null,
      revisedFeedback: null,
      realistic,
    };
    await db.sessions.put(session);
    navigate(`/interview/practice/${id}`);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title="Mock interview" subtitle="Choose a mode and a question. Answer by voice (where your browser supports it) or text. Unofficial practice." />
      <Panel title="Mode">
        <div className="grid sm:grid-cols-3 gap-2">
          {(
            [
              ["guided", "Guided", "Beginner friendly. Build the answer one STAR section at a time with hints and examples. Retry freely."],
              ["practice", "Practice", "Answer the question, get Dive Deeper follow-ups and feedback between questions. Saves progress."],
              ["realistic", "Realistic", "Timed, multiple behavioral questions plus technical follow-ups, no coaching until the end."],
            ] as const
          ).map(([m, label, desc]) => (
            <button key={m} type="button" className={`panel-2 p-3 text-left ${mode === m ? "border-amber-500" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)} data-testid={`mode-${m}`}>
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs muted">{desc}</div>
            </button>
          ))}
        </div>
      </Panel>
      {mode !== "realistic" ? (
        <Panel title="Question">
          <label className="label" htmlFor="lp">
            Leadership Principle (optional)
          </label>
          <select id="lp" className="input" value={principleId} onChange={(e) => { setPrincipleId(e.target.value as LeadershipPrincipleId | ""); setQuestionId(""); }}>
            <option value="">General behavioral question</option>
            {LEADERSHIP_PRINCIPLES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="label mt-3" htmlFor="q">
            Practice question
          </label>
          <select id="q" className="input" value={questionId} onChange={(e) => { setQuestionId(e.target.value); setCustomQuestion(""); }}>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.text}
              </option>
            ))}
          </select>
          <label className="label mt-3" htmlFor="custom">
            Or type your own question
          </label>
          <input id="custom" className="input" value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} placeholder="e.g. Explain how you investigated this issue and identified its cause." />
          <label className="label mt-3" htmlFor="story">
            Story to use (optional, from your Story Bank)
          </label>
          <select id="story" className="input" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
            <option value="">None / decide while answering</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Panel>
      ) : (
        <Panel title="Realistic session">
          <p className="text-sm muted">3 behavioral questions (different principles) and 1 technical follow-up. No coaching during the session; a full report at the end. The timer is a guide: when it ends, the session wraps up.</p>
          <label className="label mt-3" htmlFor="tl">
            Time limit (minutes)
          </label>
          <input id="tl" type="number" className="input w-28" min={5} max={45} value={timeLimit} onChange={(e) => setTimeLimit(Math.max(5, Math.min(45, Number(e.target.value) || 10)))} />
        </Panel>
      )}
      <button type="button" className="btn-primary" onClick={() => void start()} data-testid="start-session">
        Start {mode} session
      </button>
    </div>
  );
}

function pickRealistic(preferred: LeadershipPrincipleId | null): string[] {
  const pool = LEADERSHIP_PRINCIPLES.map((p) => p.questions[0]);
  const chosen: InterviewQuestion[] = [];
  if (preferred) chosen.push(LP_BY_ID.get(preferred)!.questions[0]);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const q of shuffled) if (chosen.length < 3 && !chosen.some((c) => c.principleId === q.principleId)) chosen.push(q);
  return chosen.map((q) => q.id);
}

/* ------------------------------------------------------------------ */

function SessionRunner({ session }: { session: InterviewSession }) {
  const profile = useProfile();
  const stories = useStories();
  const [busy, setBusy] = useState(false);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);
  const [guided, setGuided] = useState({ situation: "", task: "", action: "", result: "", learning: "" });
  const [remaining, setRemaining] = useState<number | null>(session.realistic ? session.realistic.timeLimitSec : null);
  const spokenRef = useRef<string | null>(null);
  const settings = profile?.settings;
  const story = stories.find((s) => s.id === session.storyId);
  const lastInterviewer = [...session.turns].reverse().find((t) => t.role === "interviewer");
  const learnerTurns = session.turns.filter((t) => t.role === "learner");
  const dd = session.diveDeeper;
  const inDiveDeeper = dd && !dd.finished;
  const finished = session.endedAt !== null;

  useEffect(() => {
    if (!settings?.speakQuestions || !canSpeak() || finished || !lastInterviewer) return;
    if (spokenRef.current === lastInterviewer.id) return;
    spokenRef.current = lastInterviewer.id;
    setSpeaking(true);
    speak(lastInterviewer.text, { onEnd: () => setSpeaking(false) });
  }, [lastInterviewer, settings?.speakQuestions, finished]);

  useEffect(() => {
    if (remaining === null || finished) return;
    const id = setInterval(() => setRemaining((r) => (r === null ? r : Math.max(0, r - 1))), 1000);
    return () => clearInterval(id);
  }, [remaining === null, finished]);

  useEffect(() => {
    if (remaining === 0 && !finished && !busy) void finishSession("time");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const save = (patch: Partial<InterviewSession>) => db.sessions.put({ ...session, ...patch });

  const addTurn = (t: Omit<InterviewTurn, "id" | "at">): InterviewTurn => ({ id: uid("turn"), at: nowIso(), ...t });

  /** First answer to the current question. */
  const submitAnswer = async (text: string, meta: { inputMode: "voice" | "text"; rawTranscript?: string; delivery?: DeliveryObservations; durationSec?: number }) => {
    setBusy(true);
    try {
      const learner = addTurn({ role: "learner", text, inputMode: meta.inputMode, rawTranscript: meta.rawTranscript, durationSec: meta.durationSec });
      const turns = [...session.turns, learner];
      let diveDeeper = session.diveDeeper;
      let extraTurns: InterviewTurn[] = [];
      if (session.mode !== "guided") {
        // Start Dive Deeper for this question (realistic mode: limited to level 1-2, no coaching text).
        const state = createDiveDeeperState(session.questionText, session.principleId, text);
        const next = nextFollowUp(state, "pending");
        if (next.followUp) {
          const t = addTurn({ role: "interviewer", text: next.followUp.text, gap: next.followUp.gap, level: next.followUp.level, hypothetical: next.followUp.hypothetical });
          const fixed = { ...next.state, followUps: next.state.followUps.map((f) => (f.turnId === "pending" ? { ...f, turnId: t.id } : f)) };
          diveDeeper = fixed;
          extraTurns = [t];
        } else diveDeeper = next.state;
      }
      await save({ turns: [...turns, ...extraTurns], diveDeeper, inputMode: meta.inputMode === "voice" ? "voice" : session.inputMode, ...(meta.delivery ? { feedback: null } : {}) });
      if (meta.delivery) pendingDelivery.current = meta.delivery;
      if (session.mode === "guided" || (session.mode !== "realistic" && !extraTurns.length)) await produceFeedback([...turns, ...extraTurns], diveDeeper);
    } finally {
      setBusy(false);
    }
  };
  const pendingDelivery = useRef<DeliveryObservations | undefined>(undefined);

  const submitFollowUp = async (text: string, meta: { inputMode: "voice" | "text"; rawTranscript?: string; durationSec?: number }) => {
    if (!dd) return;
    setBusy(true);
    try {
      const learner = addTurn({ role: "learner", text, inputMode: meta.inputMode, rawTranscript: meta.rawTranscript, durationSec: meta.durationSec });
      const applied = applyFollowUpAnswer(dd, text);
      let state = applied.state;
      const turns = [...session.turns, learner];
      const maxFollowUps = session.mode === "realistic" ? 2 : 6;
      if (!state.finished && state.followUps.length < maxFollowUps) {
        const next = nextFollowUp(state, "pending");
        if (next.followUp) {
          const t = addTurn({ role: "interviewer", text: next.followUp.text, gap: next.followUp.gap, level: next.followUp.level, hypothetical: next.followUp.hypothetical });
          state = { ...next.state, followUps: next.state.followUps.map((f) => (f.turnId === "pending" ? { ...f, turnId: t.id } : f)) };
          await save({ turns: [...turns, t], diveDeeper: state });
          return;
        }
        state = next.state;
      } else if (!state.finished) state = { ...state, finished: true, finishReason: "sufficient" };
      await save({ turns, diveDeeper: state });
      if (session.mode === "realistic") await advanceRealistic(turns, state);
      else await produceFeedback(turns, state);
    } finally {
      setBusy(false);
    }
  };

  const stopProbing = async () => {
    if (!dd) return;
    const state = stopDiveDeeper(dd, "learner-stopped");
    await save({ diveDeeper: state });
    if (session.mode === "realistic") await advanceRealistic(session.turns, state);
    else await produceFeedback(session.turns, state);
  };

  const advanceRealistic = async (turns: InterviewTurn[], state: InterviewSession["diveDeeper"]) => {
    const r = session.realistic!;
    const nextIndex = r.currentIndex + 1;
    const questionsDone = nextIndex >= r.questionIds.length;
    if (!questionsDone) {
      const q = ALL_QUESTIONS.find((x) => x.id === r.questionIds[nextIndex])!;
      const t = addTurn({ role: "interviewer", text: q.text });
      // Keep the first question's feedback basis: archive earlier dive-deeper states inside turns (coach text). For simplicity, feedback at the end uses all learner answers.
      await save({ turns: [...turns, t], diveDeeper: null, realistic: { ...r, currentIndex: nextIndex }, questionId: q.id, questionText: q.text, principleId: q.principleId });
      return;
    }
    const techAsked = turns.some((t) => t.role === "interviewer" && TECH_FOLLOWUPS.includes(t.text));
    if (!techAsked) {
      const tech = TECH_FOLLOWUPS[Math.floor(Math.random() * TECH_FOLLOWUPS.length)];
      const t = addTurn({ role: "interviewer", text: tech });
      await save({ turns: [...turns, t], diveDeeper: null, realistic: { ...r, currentIndex: nextIndex }, questionId: "technical", questionText: tech, principleId: null });
      return;
    }
    await produceFeedback(turns, state, true);
  };

  const produceFeedback = async (turns: InterviewTurn[], state: InterviewSession["diveDeeper"], wholeSession = false) => {
    const answers = turns.filter((t) => t.role === "learner");
    const answer = wholeSession ? answers.map((t) => t.text).join("\n\n") : (state?.combinedAnswer ?? answers[0]?.text ?? "");
    const { report, engineNote: note } = await getFeedback({ questionText: session.questionText, principleId: session.principleId, answer, diveDeeper: state, delivery: pendingDelivery.current }, settings!);
    pendingDelivery.current = undefined;
    setEngineNote(note);
    const coach = addTurn({ role: "coach", text: report.assessment });
    await save({ turns: [...turns, coach], feedback: report, endedAt: nowIso(), diveDeeper: state });
    await logActivity({ type: "interview-session", minutes: Math.max(2, Math.round(answers.reduce((a, t) => a + (t.durationSec ?? 60), 0) / 60)), detail: `${session.mode} · ${report.overall}/100` });
    if (story) await db.stories.update(story.id, { practiceHistory: [...story.practiceHistory, session.id] });
  };

  const finishSession = async (reason: "time" | "learner-stopped") => {
    const state = dd ? stopDiveDeeper(dd, reason) : null;
    await produceFeedback(session.turns, state, session.mode === "realistic");
  };

  const submitRevised = async (text: string) => {
    setBusy(true);
    try {
      const { report } = await getFeedback({ questionText: session.questionText, principleId: session.principleId, answer: text }, settings!);
      await save({ revisedAnswer: text, revisedFeedback: report });
    } finally {
      setBusy(false);
    }
  };

  const submitGuided = async () => {
    const text = `${guided.situation} ${guided.task} ${guided.action} ${guided.result} ${guided.learning}`.replace(/\s+/g, " ").trim();
    await submitAnswer(text, { inputMode: "text" });
  };

  const comparison = useMemo(() => (session.feedback && session.revisedFeedback ? compareFeedback(session.feedback, session.revisedFeedback) : null), [session.feedback, session.revisedFeedback]);

  if (!settings) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Link to="/interview/practice" className="text-xs muted hover:underline">
            ← New session
          </Link>
          <h1 className="text-xl font-bold capitalize">
            {session.mode} mode {session.principleId ? `· ${LP_BY_ID.get(session.principleId)?.name}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {remaining !== null && !finished && <span className={`badge ${remaining < 60 ? "text-red-400 border-red-500/50" : ""}`}>⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}
          {speaking && (
            <button type="button" className="btn-ghost" onClick={() => { stopSpeaking(); setSpeaking(false); }}>
              🔈 Stop speaking
            </button>
          )}
          {!speaking && canSpeak() && lastInterviewer && !finished && (
            <button type="button" className="btn-ghost" onClick={() => { setSpeaking(true); speak(lastInterviewer.text, { onEnd: () => setSpeaking(false) }); }}>
              🔈 Replay question
            </button>
          )}
        </div>
      </div>

      {story && (
        <Callout kind="info" title={`Using story: ${story.title}`}>
          <span className="text-xs">S: {story.situation.slice(0, 120)}… · confidence {story.confidence}</span>
        </Callout>
      )}

      <Panel title="Conversation">
        <ol className="space-y-3" data-testid="conversation">
          {session.turns.map((t) => (
            <li key={t.id} className={`flex ${t.role === "learner" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.role === "learner" ? "bg-amber-500/15" : t.role === "coach" ? "border border-emerald-500/40" : "panel-2"}`}>
                <div className="text-[11px] muted mb-0.5">
                  {t.role === "interviewer" ? "Interviewer" : t.role === "coach" ? "Coach" : "You"}
                  {t.gap ? ` · ${GAP_LABELS[t.gap]} · level ${t.level}` : ""}
                  {t.hypothetical ? " · hypothetical" : ""}
                  {t.inputMode === "voice" ? " · voice" : ""}
                </div>
                <div className="whitespace-pre-wrap">{t.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      {!finished && session.mode === "guided" && learnerTurns.length === 0 && (
        <Panel title="Guided STAR builder">
          <GuidedBuilder step={guidedStep} setStep={setGuidedStep} values={guided} setValues={setGuided} onSubmit={() => void submitGuided()} principleId={session.principleId} busy={busy} />
        </Panel>
      )}

      {!finished && session.mode !== "guided" && learnerTurns.length === 0 && (
        <Panel title="Your answer">
          <VoiceInput consent={settings.voiceConsent} disabled={busy} onSubmit={(t, m) => void submitAnswer(t, m)} autoFocus />
        </Panel>
      )}

      {!finished && inDiveDeeper && learnerTurns.length > 0 && lastInterviewer && (
        <Panel title={session.mode === "realistic" ? "Follow-up" : "Dive Deeper follow-up"} actions={session.mode !== "realistic" ? <span className="text-xs muted">Depth level {dd.level} · {dd.gaps.filter((g) => !g.resolved).length} gap(s) open</span> : undefined}>
          <VoiceInput consent={settings.voiceConsent} disabled={busy} onSubmit={(t, m) => void submitFollowUp(t, m)} placeholder='Answer the follow-up. "I don’t know" or "I don’t remember" are acceptable answers.' submitLabel="Answer follow-up" autoFocus />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void stopProbing()} data-testid="stop-probing">
              {session.mode === "realistic" ? "Move to next question" : "Stop and get coaching"}
            </button>
          </div>
        </Panel>
      )}

      {!finished && session.mode === "realistic" && !inDiveDeeper && learnerTurns.length > 0 && lastInterviewer && lastInterviewer.role === "interviewer" && session.turns[session.turns.length - 1].role === "interviewer" && (
        <Panel title="Your answer">
          <VoiceInput consent={settings.voiceConsent} disabled={busy} onSubmit={(t, m) => void submitAnswer(t, m)} autoFocus />
        </Panel>
      )}

      {busy && <div className="text-sm muted" aria-live="polite">Working…</div>}

      {session.feedback && <FeedbackView report={session.feedback} engineNote={engineNote} title="Coaching report" diveDeeper={dd} />}

      {session.feedback && session.mode !== "realistic" && (
        <Panel title="Record an improved answer">
          <p className="text-sm muted mb-2">Use the revised outline. Improvement is only declared when the new answer has stronger evidence, not just more words.</p>
          {session.revisedAnswer ? (
            <>
              <div className="panel-2 p-3 text-sm whitespace-pre-wrap">{session.revisedAnswer}</div>
              {comparison && (
                <div className="mt-3">
                  <Callout kind={comparison.improved ? "success" : "warn"} title={comparison.improved ? "Improved" : "Not yet an improvement"}>
                    {comparison.summary}
                  </Callout>
                  <ul className="text-xs mt-2 grid sm:grid-cols-2 gap-1">
                    {comparison.deltas.map((d) => (
                      <li key={d.label}>
                        {d.label}: {d.before} → {d.after}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {session.revisedFeedback && <FeedbackView report={session.revisedFeedback} title="Revised answer report" />}
            </>
          ) : (
            <VoiceInput consent={settings.voiceConsent} disabled={busy} onSubmit={(t) => void submitRevised(t)} submitLabel="Submit improved answer" />
          )}
        </Panel>
      )}

      {finished && (
        <div className="flex gap-2 flex-wrap">
          <Link to="/interview/practice" className="btn-primary">
            Practise another question
          </Link>
          <Link to="/interview/history" className="btn-secondary">
            History
          </Link>
          <Link to="/interview/stories" className="btn-secondary">
            Update Story Bank
          </Link>
        </div>
      )}
    </div>
  );
}

function GuidedBuilder({ step, setStep, values, setValues, onSubmit, principleId, busy }: { step: number; setStep: (n: number) => void; values: Record<"situation" | "task" | "action" | "result" | "learning", string>; setValues: (v: typeof values) => void; onSubmit: () => void; principleId: LeadershipPrincipleId | null; busy: boolean }) {
  const lp = principleId ? LP_BY_ID.get(principleId) : undefined;
  const steps: Array<{ key: keyof typeof values; title: string; hint: string; example: string }> = [
    { key: "situation", title: "Situation", hint: "When and where? What was going on? One to three sentences.", example: "During my first month as a volunteer at the food bank, our inventory spreadsheet broke the night before a big delivery." },
    { key: "task", title: "Task", hint: "What was YOUR responsibility or goal? Start with 'I was responsible for...' or 'My goal was...'.", example: "I was responsible for making sure the morning crew knew exactly what to unload and where." },
    { key: "action", title: "Action", hint: "What did you do, step by step, and why? Use 'I'. Name tools, evidence and the alternatives you rejected.", example: "I first checked whether the file could be recovered from the previous day's backup; it could not. Rather than rebuilding everything, I rebuilt only the delivery sheet from the supplier email, because that was all the crew needed by 7am." },
    { key: "result", title: "Result", hint: "What happened? Give a number, a before/after, or how you verified it. Do not invent figures.", example: "The crew unloaded on time; the coordinator told me it was the first delivery in weeks with no missing items. I later restored the full sheet from the supplier's records." },
    { key: "learning", title: "Lesson", hint: "What did you learn or do differently afterwards?", example: "I learned to look for the minimum thing that unblocks people first. I also set up a weekly backup." },
  ];
  const s = steps[step];
  return (
    <div className="space-y-3">
      <ProgressBar value={((step + 1) / steps.length) * 100} label={`Step ${step + 1} of ${steps.length}: ${s.title}`} />
      <p className="text-sm">{s.hint}</p>
      {lp && s.key === "action" && <Callout kind="info" title={`Show ${lp.name}`}>{lp.evidence[0]}</Callout>}
      <details className="text-xs muted">
        <summary className="cursor-pointer">Show an example (fictional)</summary>
        <p className="mt-1">{s.example}</p>
      </details>
      <textarea className="input h-28" value={values[s.key]} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} data-testid={`guided-${s.key}`} />
      <div className="flex justify-between">
        <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="btn-primary" disabled={values[s.key].trim().length < 10} onClick={() => setStep(step + 1)} data-testid="guided-next">
            Next
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={busy || values[s.key].trim().length < 5} onClick={onSubmit} data-testid="guided-submit">
            Get feedback
          </button>
        )}
      </div>
    </div>
  );
}

export function FeedbackView({ report, engineNote, title, diveDeeper }: { report: FeedbackReport; engineNote?: string | null; title: string; diveDeeper?: InterviewSession["diveDeeper"] }) {
  return (
    <Panel title={title} actions={<span className={`badge ${report.overall >= 75 ? "text-emerald-400" : report.overall >= 50 ? "text-amber-400" : "text-red-400"}`}>{report.overall}/100</span>}>
      <div className="space-y-4 text-sm" data-testid="feedback">
        <p className="font-medium">{report.assessment}</p>
        {engineNote && <div className="text-xs muted">{engineNote}</div>}
        <div className="space-y-2">
          {report.categories.map((c) => (
            <div key={c.category}>
              <ProgressBar value={c.score} label={`${c.label} (weight ${c.weight}%)`} color={c.score >= 70 ? "bg-emerald-500" : c.score >= 40 ? "bg-amber-500" : "bg-red-500"} />
              <ul className="text-xs muted mt-0.5 ml-2">
                {c.evidence.slice(0, 2).map((e) => (
                  <li key={e}>• {e}</li>
                ))}
                {c.gaps.slice(0, 2).map((g) => (
                  <li key={g} className="text-amber-400">
                    ▲ {g}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="label">Strongest supporting examples</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {report.strongest.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label">Missing details</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {report.missing.length ? report.missing.map((s) => <li key={s}>{s}</li>) : <li className="muted">None detected.</li>}
            </ul>
          </div>
        </div>
        {report.vagueStatements.length > 0 && (
          <div>
            <div className="label">Vague or unsupported statements</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {report.vagueStatements.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <div className="label">Leadership Principle alignment</div>
          <p>{report.principleAlignment}</p>
        </div>
        <div>
          <div className="label">Actionable recommendations</div>
          <ol className="list-decimal pl-5 space-y-0.5">
            {report.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </div>
        {diveDeeper && (
          <div>
            <div className="label">Dive Deeper summary</div>
            <ul className="text-xs space-y-0.5">
              <li>Questions asked: {diveDeeper.followUps.length}</li>
              <li>Additional details uncovered: {diveDeeper.newDetails.length ? diveDeeper.newDetails.map((d) => `"${d}"`).join(" ") : "none"}</li>
              <li>Remaining gaps: {diveDeeper.gaps.filter((g) => !g.resolved).map((g) => GAP_LABELS[g.type]).join(", ") || "none"}</li>
              <li>Stopped because: {diveDeeper.finishReason ?? "n/a"}</li>
            </ul>
          </div>
        )}
        <div>
          <div className="label">Suggested follow-up questions to prepare for</div>
          <ul className="list-disc pl-5">
            {report.suggestedFollowUps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label">Revised answer outline (grounded in what you said)</div>
          <dl className="grid sm:grid-cols-[6rem_1fr] gap-1 text-xs">
            {(Object.entries(report.revisedOutline) as Array<[string, string]>).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-semibold capitalize">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <div className="label">Next practice</div>
          <p>{report.nextPractice}</p>
        </div>
        {report.delivery && (
          <div>
            <div className="label">Delivery observations (from the recording)</div>
            <p className="text-xs">
              {report.delivery.wordsPerMinute} words/min · {report.delivery.durationSec}s · long pauses: {report.delivery.longPauses} · fillers: {report.delivery.fillerWords.map((f) => `${f.word}×${f.count}`).join(", ") || "none detected"}
            </p>
            <p className="text-[11px] muted">{report.delivery.note}</p>
          </div>
        )}
        <p className="text-[11px] muted border-t pt-2" style={{ borderColor: "var(--border)" }}>
          {report.limitations}
        </p>
      </div>
    </Panel>
  );
}
