import { Link, useParams } from "react-router-dom";
import { HealthGate } from "../../components/study/HealthGate";
import { Callout, PageHeader, Panel } from "../../components/ui";
import { STUDY_DISCLAIMER, examChurnNote } from "../../content/study/disclaimer";
import { ENGINE_BY_ID } from "../../content/study/engines";
import { useStudyCourse } from "../../services/study/catalog";
import { useStudyStates } from "../../data/hooks";
import { courseReadiness, dueStudyReviews } from "../../engine/study/mastery";
import { ProgressBar } from "../../components/ui";

/** One course: provenance, exam-churn note, and its units with weights and gates. */
export function StudyCoursePage() {
  const { courseId } = useParams();
  const course = useStudyCourse(courseId);
  const states = useStudyStates();
  if (course.status === "loading") return <p className="muted text-sm">Loading the course…</p>;
  if (course.status === "error") {
    return (
      <div className="space-y-4">
        <PageHeader title="Study" />
        <Callout kind="danger" title="Course not found">
          {course.message}. <Link to="/study" className="underline">Back to Study</Link>.
        </Callout>
      </div>
    );
  }
  const c = course.data;
  const p = c.provenance;
  const churn = examChurnNote(p.credentialStatus, p.retirementDate, p.examCode);
  const readiness = courseReadiness(c, states);
  const due = dueStudyReviews([...states.values()].filter((s) => s.courseId === c.id));
  return (
    <HealthGate course={c}>
      <div className="space-y-5">
        <PageHeader
          title={c.title}
          subtitle={
            <>
              <Link to="/study" className="underline">Study</Link> · {c.description}
            </>
          }
        />
        <div className="muted text-xs flex flex-wrap gap-x-4 gap-y-1" data-testid="study-provenance">
          {p.credentialName && <span>{p.credentialName}</span>}
          {p.examCode && <span>Exam {p.examCode}</span>}
          {p.credentialStatus && <span>Status: {p.credentialStatus}</span>}
          {p.sourceVerifiedAt && <span>Objectives verified against the published guide on {p.sourceVerifiedAt.slice(0, 10)}</span>}
          {p.officialObjectivesUrl && (
            <a href={p.officialObjectivesUrl} target="_blank" rel="noreferrer" className="underline">
              Official objectives
            </a>
          )}
          <span>
            {c.counts.objectives} objectives, {c.counts.linked} taught by a mission
            {c.counts.bookkeeping > 0 && `, ${c.counts.bookkeeping} bookkeeping lines`}
          </span>
        </div>
        {churn && (
          <Callout kind="warn" title="Exam revision">
            {churn}
          </Callout>
        )}
        <Panel title={readiness.kind === "readiness" ? "Readiness (weighted by exam domain)" : "Coverage"}>
          <ProgressBar value={readiness.percent} label={`${readiness.percent}%`} />
          <p className="muted text-xs mt-2" data-testid="study-readiness">
            {readiness.mastered} of {readiness.total} objectives at Independent or better.{readiness.kind === "readiness" ? " Each domain counts by its published exam weight." : ""}
            {due.length > 0 ? ` ${due.length} review${due.length === 1 ? "" : "s"} due.` : ""} Not a prediction of an exam result.
          </p>
        </Panel>
        <Panel title="Units">
          <ol className="space-y-2" data-testid="study-units">
            {c.units.map((u) => {
              const bookkeeping = u.objectives.length > 0 && u.objectives.every((o) => o.kind === "bookkeeping");
              const linked = u.objectives.filter((o) => o.link?.kind === "mission" || o.link?.kind === "lab").length;
              const mastered = u.objectives.filter((o) => { const st = states.get(o.id)?.status; return st === "independent" || st === "transfer-ready"; }).length;
              const touched = u.objectives.filter((o) => states.has(o.id)).length;
              const engine = u.gateEngine ? ENGINE_BY_ID.get(u.gateEngine) : undefined;
              return (
                <li key={u.id}>
                  <Link to={`/study/${c.id}/${u.index}`} className="panel-2 block p-3 hover:border-amber-500/60 transition-colors" data-testid={`study-unit-${u.index}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">
                        {u.index}. {u.title}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {u.weight !== undefined && <span className="badge">{u.weight}% of the exam</span>}
                        {u.rangeLabel && <span className="badge">{u.rangeLabel}</span>}
                      </div>
                    </div>
                    {u.gate && !bookkeeping && <p className="text-sm mt-1">Gate: {u.gate}</p>}
                    <div className="muted text-xs mt-2 flex flex-wrap gap-x-3">
                      <span>{u.objectives.length} {bookkeeping ? "bookkeeping lines" : "objectives"}</span>
                      {linked > 0 && <span className="accent">{linked} taught by a mission or lab</span>}
                      {touched > 0 && <span>{mastered} mastered, {touched} started</span>}
                      {engine && <span>{engine.status === "built" ? "Lab" : "Lab planned"}: {engine.name}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Panel>
        <p className="muted text-xs">{STUDY_DISCLAIMER}</p>
      </div>
    </HealthGate>
  );
}
