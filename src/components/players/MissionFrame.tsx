import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { CheckResult, Mission, MissionProgress } from "../../domain/types";
import { TRACK_BY_ID, SKILL_BY_ID } from "../../content/curriculum";
import { revealHint, saveReflection } from "../../engine/missions/engine";
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
}

/**
 * Common chrome for every mission: briefing, lesson, glossary, objectives,
 * progressive hints, live validation and completion/reflection.
 */
export function MissionFrame({ mission, progress, checks, completed, onComplete, onReset, workstation, extra, retention = false, onGiveUp }: Props) {
  const [tab, setTab] = useState<"brief" | "lesson" | "glossary">("brief");
  const [hintLevel, setHintLevel] = useState(progress?.maxHintLevel ?? 0);
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const passed = checks.filter((c) => c.passed).length;
  const allPassed = checks.length > 0 && passed === checks.length;

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
            <textarea className="input mt-2 h-28" value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="I started by... because... The evidence showed... I verified by..." />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={reflection.trim().length < 20}
                onClick={() => {
                  void saveReflection(mission.id, mission.reflectionPrompts[0], reflection);
                  setReflectionSaved(true);
                }}
              >
                Save reflection
              </button>
              {reflectionSaved && <span className="text-xs text-emerald-400">Saved.</span>}
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
              <Callout kind="success" title="Completed">
                Mastery recorded for {mission.skills.length} skill(s).
              </Callout>
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
            <button type="button" className="btn-ghost text-xs" onClick={onReset}>
              {retention ? "Restart environment" : "Reset mission environment"}
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
