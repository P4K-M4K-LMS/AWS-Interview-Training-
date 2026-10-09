import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, logActivity, updateProfile } from "../data/db";
import { useProfile } from "../data/hooks";
import { emptySkill } from "../engine/learner/mastery";
import { DEFAULT_ROLE_ID, ROLES } from "../content/roles";
import { defaultExplanationLevel } from "../engine/learner/explanation";
import type { RoleId, SkillId } from "../domain/types";
import { Callout, Panel } from "../components/ui";

/**
 * Initial beginner assessment: a few quick, honest self-placement tasks.
 * It only seeds starting points (max 25 mastery) so progress still depends on
 * demonstrated work in missions.
 */
const QUESTIONS: Array<{ id: string; skill: SkillId; prompt: string; options: string[]; correct: number }> = [
  { id: "q1", skill: "linux.navigation", prompt: "In a Linux terminal, which command shows the directory you are currently in?", options: ["pwd", "ls", "cd", "dir"], correct: 0 },
  { id: "q2", skill: "linux.reading", prompt: "Which command prints only the lines of app.log that contain the word ERROR?", options: ["cat ERROR app.log", "grep ERROR app.log", "find app.log ERROR", "echo app.log | ERROR"], correct: 1 },
  { id: "q3", skill: "python.basics", prompt: "What does this print?  x = 7 // 2 ; print(x)", options: ["3.5", "3", "4", "an error"], correct: 1 },
  { id: "q4", skill: "python.control", prompt: "Which Python keyword repeats a block once for each item in a list?", options: ["repeat", "loop", "for", "each"], correct: 2 },
  { id: "q5", skill: "algorithms.bigo", prompt: "An algorithm checks every item in a list once. As the list doubles in size, its work roughly:", options: ["stays the same", "doubles", "quadruples", "halves"], correct: 1 },
  { id: "q6", skill: "netsec.dns-ports", prompt: "DNS is the system that:", options: ["encrypts web traffic", "translates names like example.com into IP addresses", "blocks unwanted connections", "stores passwords"], correct: 1 },
];

export function OnboardingPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<RoleId>(DEFAULT_ROLE_ID);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    const assessment: Partial<Record<SkillId, number>> = {};
    for (const q of QUESTIONS) {
      const correct = answers[q.id] === q.correct;
      assessment[q.skill] = Math.max(assessment[q.skill] ?? 0, correct ? 20 : 0);
    }
    for (const [skillId, mastery] of Object.entries(assessment) as Array<[SkillId, number]>) {
      if (mastery > 0) {
        const s = emptySkill(skillId);
        await db.skills.put({ ...s, mastery, evidence: [{ at: new Date().toISOString(), missionId: "onboarding", kind: "assessment", delta: mastery, note: "initial assessment" }] });
      }
    }
    await updateProfile({ displayName: name.trim() || "Trainee", onboardingComplete: true, assessment, targetRoleId: roleId });
    await logActivity({ type: "assessment", detail: `${QUESTIONS.filter((q) => answers[q.id] === q.correct).length}/${QUESTIONS.length} correct` });
    navigate("/", { replace: true });
  };

  if (!profile) return null;
  const correctCount = QUESTIONS.filter((q) => answers[q.id] === q.correct).length;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Welcome to OpsForge</h1>
        <p className="muted text-sm mt-1">
          A fictional engineering operations environment where you learn by doing, and an interview coach for Amazon/AWS-style behavioral and technical interviews. Everything you do stays in this browser.
        </p>
      </div>
      {step === 0 && (
        <Panel title="1. Your trainee badge">
          <label className="label" htmlFor="name">
            What should we call you?
          </label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" maxLength={40} />
          <fieldset className="mt-3">
            <legend className="label">Which posting are you training toward?</legend>
            <div className="space-y-1 text-sm">
              {ROLES.map((r) => (
                <label key={r.id} className={`flex items-start gap-2 rounded-md border px-2 py-1.5 cursor-pointer ${roleId === r.id ? "border-amber-500" : ""}`} style={{ borderColor: roleId === r.id ? undefined : "var(--border)" }}>
                  <input type="radio" name="role" checked={roleId === r.id} onChange={() => setRoleId(r.id)} data-testid={`role-${r.id}`} />
                  <span>
                    <span className="font-medium">{r.title}</span>
                    {r.team && <span className="muted"> · {r.team}</span>}
                    <span className="block text-xs muted">
                      {r.qualifications.length} listed qualifications; the Curriculum page shows which ones OpsForge can train.{" "}
                      {defaultExplanationLevel(r.id) === "beginner" ? "Lessons start from plain words and explain why before how." : "Lessons assume programming experience; the plain-words primer stays one click away."}{" "}
                      You can change both in Settings.
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Callout kind="info" title="How OpsForge works">
            You start as an Engineering Trainee at Nimbus Freight, a fictional company. Missions give you real symptoms, logs and tools. You earn mastery by solving them, not by reading. About 30 minutes a day is plenty; there are no penalties for missed days.
          </Callout>
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        </Panel>
      )}
      {step === 1 && (
        <Panel title="2. Quick placement check (6 questions, no pressure)">
          <p className="text-sm muted mb-3">This only sets a starting point. Guessing is fine; missions decide your real progress.</p>
          <ol className="space-y-4">
            {QUESTIONS.map((q, i) => (
              <li key={q.id}>
                <fieldset>
                  <legend className="text-sm font-medium mb-1">
                    {i + 1}. {q.prompt}
                  </legend>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {q.options.map((o, oi) => (
                      <label key={oi} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm cursor-pointer ${answers[q.id] === oi ? "border-amber-500" : ""}`} style={{ borderColor: answers[q.id] === oi ? undefined : "var(--border)" }}>
                        <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
              Back
            </button>
            <button type="button" className="btn-primary" disabled={Object.keys(answers).length < QUESTIONS.length} onClick={() => setStep(2)}>
              See results
            </button>
          </div>
        </Panel>
      )}
      {step === 2 && (
        <Panel title="3. Your starting point">
          <p className="text-sm">
            You answered <strong>{correctCount}</strong> of {QUESTIONS.length} correctly. Skills you already know get a small head start; everything else starts from zero. Either way, your first mission is the same: find your way around a server.
          </p>
          <ul className="text-sm mt-3 space-y-1">
            {QUESTIONS.map((q) => (
              <li key={q.id} className="flex gap-2">
                <span>{answers[q.id] === q.correct ? "✓" : "·"}</span>
                <span className="muted">{q.prompt}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void finish()}>
              Start training
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
