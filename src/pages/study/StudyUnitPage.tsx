import { Link, useParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../../components/ui";
import { MISSION_BY_ID } from "../../content/missions";
import { STUDY_DISCLAIMER } from "../../content/study/disclaimer";
import { ENGINE_BY_ID } from "../../content/study/engines";
import { MODALITY_LABELS } from "../../content/study/links";
import { useStudyCourse } from "../../services/study/catalog";
import type { StudyObjective } from "../../domain/types";

function ObjectiveRow({ o }: { o: StudyObjective }) {
  const mission = o.link?.kind === "mission" ? MISSION_BY_ID.get(o.link.missionId) : undefined;
  return (
    <li className="panel-2 p-3" data-testid={`study-objective-${o.index}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">
          <span className="muted mr-2">{o.index}.</span>
          {o.text}
        </div>
        <span className="badge shrink-0" title={o.modalitySource === "curated" ? "Curated link" : "Default until lessons are generated"}>
          {MODALITY_LABELS[o.modality]}
        </span>
      </div>
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
  const learnable = unit.objectives.filter((o) => o.kind === "objective");
  const engine = unit.gateEngine ? ENGINE_BY_ID.get(unit.gateEngine) : undefined;
  return (
    <div className="space-y-5">
      <PageHeader
        title={`${unit.index}. ${unit.title}`}
        subtitle={
          <>
            <Link to="/study" className="underline">Study</Link> · <Link to={`/study/${c.id}`} className="underline">{c.title}</Link>
            {unit.weight !== undefined && ` · ${unit.weight}% of the exam`}
            {unit.rangeLabel && ` · ${unit.rangeLabel}`}
          </>
        }
      />
      {unit.gate && learnable.length > 0 && (
        <Callout kind="info" title="What mastery of this unit means">
          <span data-testid="study-gate">{unit.gate}</span>
          {engine && (
            <p className="mt-2 text-xs">
              Lab planned: <strong>{engine.name}</strong>. {engine.what} Until it exists, objectives in this unit stop at "Independent".
            </p>
          )}
        </Callout>
      )}
      {learnable.length > 0 && (
        <Panel title={`Objectives (${learnable.length})`}>
          <ol className="space-y-2" data-testid="study-objectives">
            {learnable.map((o) => <ObjectiveRow key={o.id} o={o} />)}
          </ol>
          <p className="muted text-xs mt-3">Lessons, check questions and explain-it-back for these objectives arrive with the generated content; the mission links work today.</p>
        </Panel>
      )}
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
  );
}
