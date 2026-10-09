import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { CheckResult, GlossaryEntry, Mission, MissionPrimer, MissionProgress } from "../../domain/types";
import { TRACK_BY_ID, SKILL_BY_ID } from "../../content/curriculum";
import { revealHint, saveReflectionAndStory } from "../../engine/missions/engine";
import { effectiveExplanationLevel, primerFor, primerTerms } from "../../engine/learner/explanation";
import { useProfile } from "../../data/hooks";
import { Callout, Markdown, Panel } from "../ui";

interface Props {
  mission: Mission;
  progress: MissionProgress | undefined;
  checks: CheckResult[];
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  workstation: ReactNode;
  /** Extra content under the checks (e.g. question step). */
  extra?: ReactNode;
  /** Spaced-repetition replay: fresh environment, hints disabled. */
  retention?: boolean;
  /** Retention mode only: the learner needs the lesson again (counts as not recalled). */
  onGiveUp?: () => void;
  /** Completed missions only: reopen with a fresh workstation, keeping the record. */
  onRedo?: () => void;
}

/** The free-play lab that matches a mission's workstation, if any. */
export function labForMission(mission: Mission): { to: string; label: string } | null {
  switch (mission.kind) {
    case "terminal":
    case "investigation":
      return { to: "/labs/terminal", label: "Terminal lab" };
    case "python":
      return { to: "/labs/python", label: "Python lab" };
    case "go":
      return { to: "/labs/go", label: "Go lab" };
    case "bigo":
      return { to: "/labs/algorithms", label: "Algorithms lab" };
    case "incident":
      return { to: "/labs/monitoring", label: "Monitoring lab" };
    default:
      return null;
  }
}

/**
 * Common chrome for every mission: briefing, lesson, glossary, objectives,
 * progressive hints, live validation and completion/reflection.
 */
export function MissionFrame({ mission, progress, checks, completed, onComplete, onReset, workstation, extra, retention = false, onGiveUp, onRedo }: Props) {
  const [tab, setTab] = useState<"brief" | "lesson" | "glossary">("brief");
  const [hintLevel, setHintLevel] = useState(progress?.maxHintLevel ?? 0);
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const passed = checks.filter((c) => c.passed).length;
  const allPassed = checks.length > 0 && passed === checks.length;
  const lab = labForMission(mission);
  const profile = useProfile();
  const level = effectiveExplanationLevel(profile);
  const primer = primerFor(mission);
  const terms = primerTerms(mission);

  const showHint = async (level: number) => {
    setHintLevel(level);
    await revealHint(mission.id, level);
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-4">
      <div className="space-y-4 min-w-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Link to="/missions" className="muted hover:underline">
              Missions
            </Link>
            <span className="muted">/</span>
            <span className="badge">{TRACK_BY_ID.get(mission.trackId)?.shortName}</span>
            <span className="badge">Stage {mission.stage}</span>
            <span className="badge">~{mission.estimatedMinutes} min</span>
            {lab && (
              <Link to={lab.to} className="badge hover:border-amber-500" title="Open the free-play lab in this tab; your mission state is saved" data-testid="mission-lab-link">
                {lab.label} ↗
              </Link>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-1">{mission.title}</h1>
          <p className="muted text-sm">{mission.summary}</p>
        </div>

        {retention && (
          <Callout kind="warn" title="Retention check">
            Spaced repetition: redo this mission from a fresh environment without hints. Passing raises mastery and pushes the next review further out; giving up lowers it and schedules a review tomorrow. The lesson tab stays available, but reading it is on you.
          </Callout>
        )}

        <Panel>
          <div className="flex gap-1 mb-3 border-b" style={{ borderColor: "var(--border)" }} role="tablist">
            {(["brief", "lesson", "glossary"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${tab === t ? "border-amber-500 text-amber-500" : "border-transparent muted"}`} onClick={() => setTab(t)}>
                {t === "brief" ? "Briefing" : t === "lesson" ? `Lesson (${mission.lesson.length})` : "Glossary"}
              </button>
            ))}
          </div>
          {tab === "brief" && (
            <div className="space-y-3">
              <Callout kind="info" title="Fictional scenario">
                <Markdown text={mission.briefing} />
              </Callout>
              {primer && level === "beginner" && (
                <p className="text-sm" data-testid="primer-nudge">
                  New to this? Open the{" "}
                  <button type="button" className="underline" onClick={() => setTab("lesson")}>
                    Lesson tab
                  </button>{" "}
                  first: it starts in plain words and explains why before how.
                </p>
              )}
              <div>
                <div className="label">Objectives</div>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  {mission.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
              <div className="text-xs muted">Skills exercised: {mission.skills.map((s) => SKILL_BY_ID.get(s)?.name ?? s).join(", ")}</div>
            </div>
          )}
          {tab === "lesson" && (
            <div className="space-y-4">
              {primer &&
                (level === "beginner" ? (
                  <section className="panel-2 p-3" data-testid="primer">
                    <PrimerBody primer={primer} terms={terms} onTerm={() => setTab("glossary")} />
                  </section>
                ) : (
                  <details className="panel-2 p-3" data-testid="primer-collapsed">
                    <summary className="cursor-pointer text-sm font-semibold">Start from the basics: plain words and the why</summary>
                    <div className="mt-3">
                      <PrimerBody primer={primer} terms={terms} onTerm={() => setTab("glossary")} />
                    </div>
                  </details>
                ))}
              {primer && <div className="label">How to do it</div>}
              {mission.lesson.map((l) => (
                <div key={l.title}>
                  <h3 className="font-semibold">{l.title}</h3>
                  <Markdown text={l.body} />
                </div>
              ))}
              <Callout kind="warn">Reading this lesson does not earn mastery. Completing the mission does.</Callout>
            </div>
          )}
          {tab === "glossary" && (
            <dl className="text-sm space-y-2">
              {mission.glossary.map((g) => (
                <div key={g.term}>
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="muted">{g.definition}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>

        {workstation}

        {completed && (
          <Panel title="Mission complete: explain what you did">
            <p className="text-sm muted mb-2">
              Interview practice: answer the prompt as if a technical interviewer asked it. This builds the habit of narrating investigation steps. Remember this was a simulation, so in a real interview describe it as practice, never as workplace experience.
            </p>
            <p className="text-sm font-medium">{mission.reflectionPrompts[0]}</p>
            <textarea className="input mt-2 h-28" value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="I started by... because... The evidence showed... I verified by..." data-testid="reflection-input" />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={reflection.trim().length < 20}
                onClick={() => {
                  void saveReflectionAndStory(mission, mission.reflectionPrompts[0], reflection);
                  setReflectionSaved(true);
                }}
                data-testid="save-reflection"
              >
                Save reflection
              </button>
              {reflectionSaved && (
                <span className="text-xs text-emerald-400" data-testid="reflection-saved">
                  Saved, and a draft story was added to your{" "}
                  <Link to="/interview/stories" className="underline">
                    Story Bank
                  </Link>{" "}
                  (marked as practice).
                </span>
              )}
              <Link to={`/interview/practice?question=${encodeURIComponent(mission.reflectionPrompts[0])}&fromMission=${mission.id}`} className="btn-ghost">
                Get STAR feedback on this →
              </Link>
            </div>
            <Callout kind="success" title="Transfer note">
              {mission.transferNote}
            </Callout>
          </Panel>
        )}
      </div>

      <aside className="space-y-4">
        <Panel title={`Checks (${passed}/${checks.length})`}>
          <ul className="space-y-1 text-sm" data-testid="mission-checks">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className={c.passed ? "text-emerald-400" : "muted"}>{c.passed ? "✓" : "○"}</span>
                <span>
                  {c.label}
                  {c.detail && !c.passed && <span className="block text-xs muted">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {extra}
          <div className="mt-3 flex flex-col gap-2">
            {completed ? (
              <>
                <Callout kind="success" title="Completed">
                  Mastery recorded for {mission.skills.length} skill(s).
                </Callout>
                {onRedo && (
                  <button type="button" className="btn-secondary" onClick={onRedo} data-testid="mission-redo" title="Fresh workstation, hints on, nothing scored. Your completion, reflections and retention history are kept.">
                    Redo this mission (keeps your record)
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="btn-primary" disabled={!allPassed} onClick={onComplete} data-testid="mission-complete">
                {allPassed ? (retention ? "Confirm retention check" : "Complete mission") : "Complete all checks to finish"}
              </button>
            )}
            {retention && onGiveUp && (
              <button type="button" className="btn-secondary text-xs" onClick={onGiveUp} data-testid="retention-give-up">
                I need the lesson again (ends the check)
              </button>
            )}
            <button type="button" className="btn-ghost text-xs" onClick={onReset} data-testid="mission-reset">
              {retention ? "Restart environment" : completed ? "Start over (forgets this completion)" : "Reset mission environment"}
            </button>
          </div>
        </Panel>

        <Panel title="Hints">
          {retention ? (
            <p className="text-xs muted" data-testid="hints-disabled">
              Hints are disabled during a retention check. If you are stuck, end the check with "I need the lesson again" and the mission reopens with hints.
            </p>
          ) : (
          <>
          <p className="text-xs muted mb-2">Hints get more specific. Using fewer hints earns more mastery. Stuck for 5+ minutes? Take one.</p>
          {primer && (level === "beginner" || hintLevel >= 1) && (
            <div className="panel-2 p-2 mb-2 text-sm" data-testid="primer-first-step">
              <div className="text-xs font-semibold">Why start here</div>
              <p>{primer.firstStep}</p>
            </div>
          )}
          <ol className="space-y-2">
            {mission.hints.map((h) => (
              <li key={h.level}>
                {h.level <= hintLevel ? (
                  <div className="panel-2 p-2">
                    <div className="text-xs font-semibold">
                      Hint {h.level}: {h.title}
                    </div>
                    <Markdown text={h.body} />
                  </div>
                ) : (
                  <button type="button" className="btn-secondary w-full justify-start" disabled={h.level !== hintLevel + 1 || completed} onClick={() => void showHint(h.level)} data-testid={`hint-${h.level}`}>
                    Reveal hint {h.level}: {h.level === 1 ? "small nudge" : h.level === 2 ? "more specific" : h.level === 3 ? "concept explained" : "guided example"}
                  </button>
                )}
              </li>
            ))}
          </ol>
          </>
          )}
        </Panel>

        {progress && (
          <div className="text-xs muted">
            Attempts: {progress.attempts} · Hints: {progress.hintsUsed} · Status: {progress.status}
          </div>
        )}
      </aside>
    </div>
  );
}

/** The three primer questions, then the glossary terms the primer leans on. */
function PrimerBody({ primer, terms, onTerm }: { primer: MissionPrimer; terms: GlossaryEntry[]; onTerm: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h3 className="font-semibold">In plain words</h3>
        <Markdown text={primer.plain} />
      </div>
      <div>
        <h3 className="font-semibold">Why it matters</h3>
        <Markdown text={primer.why} />
      </div>
      <div>
        <h3 className="font-semibold">Why this way</h3>
        <Markdown text={primer.whyThisWay} />
      </div>
      {terms.length > 0 && (
        <p className="text-xs muted" data-testid="primer-terms">
          Terms used here, defined in the Glossary tab:{" "}
          {terms.map((t, i) => (
            <span key={t.term}>
              {i > 0 && ", "}
              <button type="button" className="underline" onClick={onTerm}>
                {t.term}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
