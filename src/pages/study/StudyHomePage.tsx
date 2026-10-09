import { Link } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../../components/ui";
import { STUDY_DISCLAIMER, examChurnNote } from "../../content/study/disclaimer";
import { ENGINES } from "../../content/study/engines";
import { MODALITY_HELP, MODALITY_LABELS } from "../../content/study/links";
import { useStudyIndex } from "../../services/study/catalog";
import { useStudyStates } from "../../data/hooks";
import { isMastered } from "../../engine/study/mastery";
import type { StudyCourseSummary, StudyModality } from "../../domain/types";

const MODALITY_ORDER: StudyModality[] = ["do-existing", "do-new", "combo", "explain", "read"];

function CourseCard({ c, mastered, started }: { c: StudyCourseSummary; mastered: number; started: number }) {
  const churn = examChurnNote(c.credentialStatus, c.retirementDate, c.examCode);
  const doing = c.modalities["do-existing"] + c.modalities["do-new"];
  return (
    <Link to={`/study/${c.id}`} className="panel-2 block p-3 hover:border-amber-500/60 transition-colors" data-testid={`study-course-${c.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">{c.title}</div>
        {c.examCode && <span className="badge shrink-0">{c.examCode}</span>}
      </div>
      <p className="muted text-xs mt-1 line-clamp-2">{c.description}</p>
      <div className="muted text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span>{c.counts.units} units</span>
        <span>{c.counts.objectives} objectives</span>
        {c.counts.linked > 0 && <span className="accent">{c.counts.linked} taught by a mission</span>}
        {doing > c.counts.linked && <span>{doing - c.counts.linked} lab planned</span>}
        {started > 0 && <span className="accent">{mastered} mastered, {started} started</span>}
      </div>
      {churn && <div className="text-xs mt-2 text-amber-500">{churn}</div>}
    </Link>
  );
}

/**
 * Study home: the Ascendra catalog as a sibling to the mission curriculum.
 * Two groups (AWS certifications, core computer science), one honest
 * disclaimer, and the plan for the hands-on parts that do not exist yet.
 */
export function StudyHomePage() {
  const index = useStudyIndex();
  const states = useStudyStates();
  const perCourse = new Map<string, { mastered: number; started: number }>();
  for (const s of states.values()) {
    const row = perCourse.get(s.courseId) ?? { mastered: 0, started: 0 };
    row.started += 1;
    if (isMastered(s.status)) row.mastered += 1;
    perCourse.set(s.courseId, row);
  }
  const card = (c: StudyCourseSummary) => <CourseCard key={c.id} c={c} mastered={perCourse.get(c.id)?.mastered ?? 0} started={perCourse.get(c.id)?.started ?? 0} />;
  return (
    <div className="space-y-5">
      <PageHeader title="Study" subtitle="Exam-style objective catalogs, learned the OpsForge way: do it in a mission where one exists, read and check where it does not, and explain it back. Separate from skill mastery." />
      <Callout kind="warn" title="Unofficial material">
        <span data-testid="study-disclaimer">{STUDY_DISCLAIMER}</span>
      </Callout>
      {index.status === "loading" && <p className="muted text-sm">Loading the catalog…</p>}
      {index.status === "error" && (
        <Callout kind="danger" title="The catalog did not load">
          {index.message}. Reload the page; if it keeps failing, the deploy is missing public/study.
        </Callout>
      )}
      {index.status === "ready" && (
        <>
          <Panel title="AWS certifications (11 courses)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="study-group-aws">
              {index.data.courses.filter((c) => c.group === "aws").map(card)}
            </div>
          </Panel>
          <Panel title="Core computer science and security (9 courses)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="study-group-core">
              {index.data.courses.filter((c) => c.group === "core").map(card)}
            </div>
          </Panel>
        </>
      )}
      <Panel title="How each objective is learned">
        <ul className="text-sm space-y-2">
          {MODALITY_ORDER.map((m) => (
            <li key={m}>
              <span className="badge mr-2">{MODALITY_LABELS[m]}</span>
              <span className="muted">{MODALITY_HELP[m]}</span>
            </li>
          ))}
        </ul>
        <p className="muted text-xs mt-3">Today only the curated mission links are labelled; every other objective reads as "Read and check" until the generated lessons add their suggestions.</p>
      </Panel>
      <Panel title="Hands-on parts still to build">
        <p className="muted text-sm mb-2">These labs would turn the largest "read" clusters into "do". Vendor-neutral by design: OpsForge never emulates a vendor's console or syntax.</p>
        <ul className="text-sm space-y-1" data-testid="study-engines">
          {ENGINES.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <span className="font-medium">{e.name}</span>
              <span className="badge">{e.status === "built" ? "built" : "planned"}</span>
              <span className="muted">{e.what} (about {e.approxObjectives} objectives)</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
