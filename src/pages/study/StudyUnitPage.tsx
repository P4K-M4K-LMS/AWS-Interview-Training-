import { Link, useParams } from "react-router-dom";
import { HealthGate } from "../../components/study/HealthGate";
import { Callout, PageHeader, Panel } from "../../components/ui";
import { MISSION_BY_ID } from "../../content/missions";
import { STUDY_DISCLAIMER } from "../../content/study/disclaimer";
import { ENGINE_BY_ID } from "../../content/study/engines";
import { LAB_LABELS } from "../../content/study/labs";
import { MODALITY_LABELS } from "../../content/study/links";
import { useCourseLessons, useStudyCourse } from "../../services/study/catalog";
import { orderObjectives } from "../../engine/study/select";
import { useProfile, useStudyUnitStates } from "../../data/hooks";
import { ScenarioPlayer } from "../../components/study/ScenarioPlayer";
import { DEFAULT_SETTINGS } from "../../data/db";
import { useStudyStates } from "../../data/hooks";
import { STUDY_STATUS_LABELS, STUDY_STATUS_MEANING, courseReadiness, statusCap } from "../../engine/study/mastery";
import type { StudyObjective, StudyObjectiveState } from "../../domain/types";

function ObjectiveRow({ o, state, courseId, unitIndex, hasLesson }: { o: StudyObjective; state?: StudyObjectiveState; courseId: string; unitIndex: number; hasLesson: boolean }) {
  const mission = o.link?.kind === "mission" ? MISSION_BY_ID.get(o.link.missionId) : undefined;
  const status = state?.status ?? "not-started";
  const cap = statusCap(o);
  return (
    <li className="panel-2 p-3" data-testid={`study-objective-${o.index}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">
          <span className="muted mr-2">{o.index}.</span>
          <Link to={`/study/${courseId}/${unitIndex}/${o.index}`} className="hover:underline" data-testid={`study-open-${o.index}`}>
            {o.text}
          </Link>
          {hasLesson && <span className="badge ml-2">lesson</span>}
          {state?.nextReviewAt && state.nextReviewAt <= new Date().toISOString() && <span className="badge ml-2 text-amber-500">review due</span>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="badge" title={o.modalitySource === "curated" ? "Curated link" : "Default until lessons are generated"}>
            {MODALITY_LABELS[o.modality]}
          </span>
          <span className={`badge ${status === "needs-review" ? "text-amber-500" : status === "not-started" ? "muted" : "accent"}`} title={STUDY_STATUS_MEANING[status]} data-testid={`study-status-${o.index}`}>
            {STUDY_STATUS_LABELS[status]}
            {cap === "independent" && status !== "not-started" ? " (caps until the lab exists)" : ""}
          </span>
        </div>
      </div>
      {o.link?.kind === "lab" && (
        <div className="mt-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link to={`/labs/${o.link.labId}${o.link.exerciseId ? `?exercise=${o.link.exerciseId}&from=${encodeURIComponent(o.id)}` : `?from=${encodeURIComponent(o.id)}`}`} className="btn-secondary text-xs" data-testid={`study-practise-${o.index}`}>
            Practise in: {LAB_LABELS[o.link.labId] ?? o.link.labId}
          </Link>
          <span className="muted text-xs">
            {o.link.coverage === "full" ? "Covers the objective." : "Covers part of it."}
            {o.link.note ? ` ${o.link.note[0].toUpperCase()}${o.link.note.slice(1)}.` : ""}
          </span>
        </div>
      )}
      {mission && o.link?.kind === "mission" && (
        <div className="mt-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link to={`/missions/${mission.id}?from=${encodeURIComponent(o.id)}`} className="btn-secondary text-xs" data-testid={`study-practise-${o.index}`}>
            Practise in: {mission.title}
          </Link>
          <span className="muted text-xs">
            {o.link.coverage === "full" ? "Covers the objective." : "Covers part of it."}
            {o.link.note ? ` ${o.link.note[0].toUpperCase()}${o.link.note.slice(1)}.` : ""}
          </span>
        </div>
      )}
      {o.labPrompt && (
        <details className="mt-2 text-xs">
          <summary className="muted cursor-pointer">Hands-on prompt from the source (for your own machine, not simulated here)</summary>
          <p className="mt-1">{o.labPrompt}</p>
        </details>
      )}
    </li>
  );
}

/** One unit: its gate, the planned engine if any, and every objective with its modality and mission link. */
export function StudyUnitPage() {
  const { courseId, unitIndex } = useParams();
  const course = useStudyCourse(courseId);
  const lessons = useCourseLessons(courseId);
  const states = useStudyStates();
  const unitStates = useStudyUnitStates();
  const profile = useProfile();
  if (course.status === "loading") return <p className="muted text-sm">Loading the unit…</p>;
  if (course.status === "error") {
    return (
      <Callout kind="danger" title="Course not found">
        {course.message}. <Link to="/study" className="underline">Back to Study</Link>.
      </Callout>
    );
  }
  const c = course.data;
  const idx = Number(unitIndex);
  const unit = c.units.find((u) => u.index === idx);
  if (!unit) {
    return (
      <Callout kind="danger" title="Unit not found">
        This course has {c.units.length} units. <Link to={`/study/${c.id}`} className="underline">Back to {c.title}</Link>.
      </Callout>
    );
  }
  const prev = c.units.find((u) => u.index === idx - 1);
  const next = c.units.find((u) => u.index === idx + 1);
  const bookkeeping = unit.objectives.filter((o) => o.kind === "bookkeeping");
  const style = profile?.settings.studyStyle;
  const learnable = orderObjectives(unit.objectives.filter((o) => o.kind === "objective"), style);
  const lessonIds = new Set(lessons.status === "ready" ? lessons.data.byObjective.keys() : []);
  const scenario = lessons.status === "ready" ? lessons.data.generated?.scenarios.find((s) => s.unitId === unit.id) : undefined;
  const engine = unit.gateEngine ? ENGINE_BY_ID.get(unit.gateEngine) : undefined;
  const unitReadiness = courseReadiness({ units: [unit] }, states);
  return (
    <HealthGate course={c}>
      <div className="space-y-5">
        <PageHeader
          title={`${unit.index}. ${unit.title}`}
          subtitle={
            <>
              <Link to="/study" className="underline">Study</Link> · <Link to={`/study/${c.id}`} className="underline">{c.title}</Link>
              {unit.weight !== undefined && ` · ${unit.weight}% of the exam`}
              {unit.rangeLabel && ` · ${unit.rangeLabel}`}
              {learnable.length > 0 && ` · ${unitReadiness.mastered} of ${unitReadiness.total} at Independent or better`}
            </>
          }
        />
        {unit.gate && learnable.length > 0 && (
          <Callout kind="info" title="What mastery of this unit means">
            <span data-testid="study-gate">{unit.gate}</span>
            {engine && engine.status === "built" && engine.lab && (
              <p className="mt-2 text-xs">
                Lab: <Link to={engine.lab} className="underline"><strong>{engine.name}</strong></Link>. {engine.what}
              </p>
            )}
            {engine && engine.status !== "built" && (
              <p className="mt-2 text-xs">
                Lab planned: <strong>{engine.name}</strong>. {engine.what} Until it exists, objectives in this unit stop at "Independent".
              </p>
            )}
          </Callout>
        )}
        {learnable.length > 0 && (
          <Panel title={`Objectives (${learnable.length})${style && style !== "mixed" ? `, ${style} first` : ""}`}>
            <ol className="space-y-2" data-testid="study-objectives">
              {learnable.map((o) => <ObjectiveRow key={o.id} o={o} state={states.get(o.id)} courseId={c.id} unitIndex={unit.index} hasLesson={lessonIds.has(o.id)} />)}
            </ol>
            {lessons.status === "ready" && lessons.data.byObjective.size === 0 && <p className="muted text-xs mt-3" data-testid="unit-no-lessons">No lessons generated for this course yet; objectives open to their catalog entry and mission link.</p>}
            <p className="muted text-xs mt-3">Status follows the 0–4 rubric: a mission credit reaches Guided, open answers you rate yourself reach Independent, Transfer-ready needs two answers graded by the proxy. Lessons and check questions arrive with the generated content; the mission links work today.</p>
          </Panel>
        )}
        {scenario && learnable.length > 0 && <ScenarioPlayer scenario={scenario} state={unitStates.get(unit.id)} settings={profile?.settings ?? DEFAULT_SETTINGS} />}
        {bookkeeping.length > 0 && (
          <details className="panel p-3" data-testid="study-bookkeeping">
            <summary className="cursor-pointer text-sm">
              {bookkeeping.length} degree-plan lines (requirements, not learning objectives)
            </summary>
            <ul className="mt-2 text-sm muted list-disc pl-5 space-y-1">
              {bookkeeping.map((o) => <li key={o.id}>{o.text}</li>)}
            </ul>
          </details>
        )}
        <div className="flex justify-between text-sm">
          {prev ? <Link to={`/study/${c.id}/${prev.index}`} className="btn-ghost">← {prev.title}</Link> : <span />}
          {next ? <Link to={`/study/${c.id}/${next.index}`} className="btn-ghost">{next.title} →</Link> : <span />}
        </div>
        <p className="muted text-xs">{STUDY_DISCLAIMER}</p>
      </div>
    </HealthGate>
  );
}
