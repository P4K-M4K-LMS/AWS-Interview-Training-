import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel, ProgressBar } from "../../components/ui";
import { STUDY_DISCLAIMER, examChurnNote } from "../../content/study/disclaimer";
import { ENGINES } from "../../content/study/engines";
import { MODALITY_HELP, MODALITY_LABELS } from "../../content/study/links";
import { FIELDS, LEVELS, PATHS, type StudyField, type StudyLevel } from "../../content/study/paths";
import { useLessonsIndex, useSearchIndex, useStudyIndex } from "../../services/study/catalog";
import { useStudyStates } from "../../data/hooks";
import { isMastered } from "../../engine/study/mastery";
import type { StudyCourseSummary, StudyLessonsIndex, StudyModality } from "../../domain/types";

const MODALITY_ORDER: StudyModality[] = ["do-existing", "do-new", "combo", "explain", "read"];
const MAX_OBJECTIVE_HITS = 40;

type Progress = { mastered: number; started: number; last: string };
type LessonCounts = StudyLessonsIndex["courses"][string] | undefined;

function lessonLabel(n: LessonCounts, objectives: number): { text: string; ready: boolean } {
  const playable = Math.max(n?.generated ?? 0, n?.imported ?? 0);
  if (!n || playable === 0) return { text: "No lessons yet", ready: false };
  if (n.generated >= objectives) return { text: "All lessons ready", ready: true };
  return { text: `${playable} of ${objectives} lessons`, ready: true };
}

function CourseCard({ c, progress, lessons, startHere }: { c: StudyCourseSummary; progress?: Progress; lessons: LessonCounts; startHere?: boolean }) {
  const churn = examChurnNote(c.credentialStatus, c.retirementDate, c.examCode);
  const label = lessonLabel(lessons, c.counts.objectives);
  return (
    <Link to={`/study/${c.id}`} className="panel-2 block p-3 hover:border-amber-500/60 transition-colors min-w-0" data-testid={`study-course-${c.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium min-w-0">{c.title}</div>
        {c.examCode && <span className="badge shrink-0">{c.examCode}</span>}
      </div>
      <p className="muted text-xs mt-1 line-clamp-2">{c.description}</p>
      <div className="muted text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span>{LEVELS[c.level].label}</span>
        <span>{c.counts.objectives} objectives</span>
        <span className={label.ready ? "accent" : undefined} data-testid={`study-lessons-${c.id}`}>{label.text}</span>
        {startHere && <span className="accent">Start here</span>}
        {c.requiresAcknowledgement && <span>Health disclaimer</span>}
      </div>
      {progress && progress.started > 0 && (
        <div className="mt-2">
          <ProgressBar value={c.counts.objectives ? (progress.mastered / c.counts.objectives) * 100 : 0} label={`${progress.mastered} mastered, ${progress.started} started`} />
        </div>
      )}
      {churn && <div className="text-xs mt-2 text-amber-500">{churn}</div>}
    </Link>
  );
}

/** One learning path as a row of steps; the first step is where a beginner starts. */
function PathRow({ steps, title, blurb, byCode }: { steps: string[]; title: string; blurb: string; byCode: Map<string, StudyCourseSummary> }) {
  return (
    <div className="panel-2 p-3 min-w-0">
      <div className="font-medium text-sm">{title}</div>
      <p className="muted text-xs mt-0.5">{blurb}</p>
      <ol className="mt-2 flex flex-wrap items-center gap-1 text-xs">
        {steps.map((code, i) => {
          const c = byCode.get(code);
          if (!c) return null;
          return (
            <li key={code} className="flex items-center gap-1">
              {i > 0 && <span className="muted" aria-hidden>→</span>}
              <Link to={`/study/${c.id}`} className={`badge hover:border-amber-500/60 ${i === 0 ? "accent" : ""}`}>
                {i === 0 && <span className="sr-only">Start here: </span>}
                {c.examCode ?? c.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Study home. Courses the learner has started come first; then every course
 * grouped by area and field, each field with its suggested learning paths
 * and its courses by level. Search covers course names, exam codes and every
 * objective's text; filters narrow by field, level and whether lessons exist.
 * Filters live in the URL so a filtered view can be bookmarked or shared.
 */
export function StudyHomePage() {
  const index = useStudyIndex();
  const lessonsIndex = useLessonsIndex();
  const states = useStudyStates();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const field = (params.get("field") ?? "all") as StudyField | "all";
  const level = (params.get("level") ?? "all") as StudyLevel | "all";
  const onlyLessons = params.get("lessons") === "1";
  const term = q.trim().toLowerCase();
  const search = useSearchIndex(term.length >= 3);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const progress = useMemo(() => {
    const out = new Map<string, Progress>();
    for (const s of states.values()) {
      const row = out.get(s.courseId) ?? { mastered: 0, started: 0, last: "" };
      row.started += 1;
      if (isMastered(s.status)) row.mastered += 1;
      if ((s.lastPracticedAt ?? "") > row.last) row.last = s.lastPracticedAt ?? "";
      out.set(s.courseId, row);
    }
    return out;
  }, [states]);

  const lessons = lessonsIndex.status === "ready" ? lessonsIndex.data.courses : {};
  const courses = index.status === "ready" ? index.data.courses : [];
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const byId = new Map(courses.map((c) => [c.id, c]));
  const startCodes = new Set(PATHS.map((p) => p.steps[0]));

  const hasLessons = (c: StudyCourseSummary) => lessonLabel(lessons[c.id], c.counts.objectives).ready;
  const passesFilters = (c: StudyCourseSummary | undefined) => !!c && (field === "all" || c.group === field) && (level === "all" || c.level === level) && (!onlyLessons || hasLessons(c));
  const matchesTerm = (c: StudyCourseSummary) => !term || [c.title, c.code, c.examCode ?? "", c.description].some((t) => t.toLowerCase().includes(term));
  const filtering = term !== "" || field !== "all" || level !== "all" || onlyLessons;
  const shown = courses.filter((c) => passesFilters(c) && matchesTerm(c));

  const objectiveHits =
    term.length >= 3 && search.status === "ready"
      ? search.data.objectives.filter(([id, text]) => text.toLowerCase().includes(term) && passesFilters(byId.get(id.split(":")[0])))
      : [];

  const card = (c: StudyCourseSummary) => <CourseCard key={c.id} c={c} progress={progress.get(c.id)} lessons={lessons[c.id]} startHere={startCodes.has(c.code)} />;
  const continuing = courses.filter((c) => (progress.get(c.id)?.started ?? 0) > 0).sort((a, b) => (progress.get(b.id)?.last ?? "").localeCompare(progress.get(a.id)?.last ?? ""));
  const levelsPresent = (Object.keys(LEVELS) as StudyLevel[]).filter((l) => courses.some((c) => c.level === l)).sort((a, b) => LEVELS[a].order - LEVELS[b].order);
  const areas = [...new Set(FIELDS.map((f) => f.area))];

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
          {continuing.length > 0 && !filtering && (
            <Panel title="Continue where you left off">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="study-continue">
                {continuing.slice(0, 6).map(card)}
              </div>
            </Panel>
          )}

          <Panel title={`Find a course (${courses.length} courses)`}>
            <div className="space-y-3">
              <input
                type="search"
                className="input"
                placeholder="Search courses, exam codes and objectives, e.g. VPC peering, NCLEX, PMP"
                value={q}
                onChange={(e) => set("q", e.target.value)}
                aria-label="Search Study"
                data-testid="study-search"
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Field" data-testid="study-field-filter">
                {[{ id: "all", title: "All fields" }, ...FIELDS].map((f) => (
                  <button key={f.id} type="button" className={`badge ${field === f.id ? "border-amber-500 accent" : ""}`} aria-pressed={field === f.id} onClick={() => set("field", f.id)} data-testid={`study-field-${f.id}`}>
                    {f.title}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="muted">Level</span>
                  <select className="input !w-auto" value={level} onChange={(e) => set("level", e.target.value)} data-testid="study-level-filter">
                    <option value="all">Any level</option>
                    {levelsPresent.map((l) => (
                      <option key={l} value={l}>{LEVELS[l].label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={onlyLessons} onChange={(e) => set("lessons", e.target.checked ? "1" : null)} data-testid="study-lessons-filter" />
                  <span>Only courses with lessons</span>
                </label>
                {filtering && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          </Panel>

          {filtering ? (
            <>
              <Panel title={`${shown.length} course${shown.length === 1 ? "" : "s"}`}>
                {shown.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="study-results">
                    {shown.map(card)}
                  </div>
                ) : (
                  <p className="muted text-sm">No course matches. Try fewer words, or clear a filter.</p>
                )}
              </Panel>
              {term.length >= 3 && (
                <Panel title="Objectives that mention it">
                  {search.status === "loading" && <p className="muted text-sm">Searching every objective…</p>}
                  {search.status === "error" && <p className="muted text-sm">Objective search did not load: {search.message}.</p>}
                  {search.status === "ready" && (
                    <>
                      {objectiveHits.length === 0 && <p className="muted text-sm">No objective text matches.</p>}
                      <ul className="text-sm space-y-1" data-testid="study-objective-results">
                        {objectiveHits.slice(0, MAX_OBJECTIVE_HITS).map(([id, text]) => {
                          const [courseId, unit, obj] = id.split(":");
                          const c = byId.get(courseId);
                          return (
                            <li key={id} className="min-w-0">
                              <Link to={`/study/${courseId}/${unit}/${obj}`} className="underline break-words">{text}</Link>
                              <span className="muted text-xs"> · {c?.examCode ?? c?.title}, unit {unit}</span>
                            </li>
                          );
                        })}
                      </ul>
                      {objectiveHits.length > MAX_OBJECTIVE_HITS && <p className="muted text-xs mt-2">Showing {MAX_OBJECTIVE_HITS} of {objectiveHits.length}. Add a word or pick a field to narrow it.</p>}
                    </>
                  )}
                </Panel>
              )}
            </>
          ) : (
            <>
              <nav aria-label="Jump to a field" className="flex flex-wrap gap-2 text-xs">
                {FIELDS.map((f) => (
                  <button key={f.id} type="button" onClick={() => document.getElementById(`study-section-${f.id}`)?.scrollIntoView({ behavior: "smooth" })} className="badge hover:border-amber-500/60">
                    {f.title} ({courses.filter((c) => c.group === f.id).length})
                  </button>
                ))}
              </nav>
              {areas.map((area) => (
                <section key={area} className="space-y-4">
                  <h2 className="text-lg font-semibold">{area}</h2>
                  {FIELDS.filter((f) => f.area === area).map((f) => {
                    const inField = courses.filter((c) => c.group === f.id);
                    if (!inField.length) return null;
                    const paths = PATHS.filter((p) => p.field === f.id);
                    return (
                      <div key={f.id} id={`study-section-${f.id}`} className="scroll-mt-4">
                        <Panel title={`${f.title} (${inField.length} courses)`}>
                          <p className="muted text-sm mb-3">{f.blurb}</p>
                          {paths.length > 0 && (
                            <div className="mb-4">
                              <h3 className="text-sm font-medium mb-2">Suggested paths</h3>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid={`study-paths-${f.id}`}>
                                {paths.map((p) => <PathRow key={p.id} steps={p.steps} title={p.title} blurb={p.blurb} byCode={byCode} />)}
                              </div>
                            </div>
                          )}
                          <div className="space-y-3" data-testid={`study-group-${f.id}`}>
                            {levelsPresent.map((l) => {
                              const atLevel = inField.filter((c) => c.level === l);
                              if (!atLevel.length) return null;
                              return (
                                <div key={l}>
                                  <h3 className="text-sm font-medium mb-2">{LEVELS[l].label}</h3>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{atLevel.map(card)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </Panel>
                      </div>
                    );
                  })}
                </section>
              ))}
            </>
          )}
        </>
      )}
      <details className="panel p-4">
        <summary className="cursor-pointer font-medium">How each objective is learned</summary>
        <ul className="text-sm space-y-2 mt-3">
          {MODALITY_ORDER.map((m) => (
            <li key={m}>
              <span className="badge mr-2">{MODALITY_LABELS[m]}</span>
              <span className="muted">{MODALITY_HELP[m]}</span>
            </li>
          ))}
        </ul>
      </details>
      <details className="panel p-4">
        <summary className="cursor-pointer font-medium">Hands-on parts still to build</summary>
        <p className="muted text-sm my-2">These labs would turn the largest "read" clusters into "do". Vendor-neutral by design: OpsForge never emulates a vendor's console or syntax.</p>
        <ul className="text-sm space-y-1" data-testid="study-engines">
          {ENGINES.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              {e.status === "built" && e.lab ? <Link to={e.lab} className="font-medium underline">{e.name}</Link> : <span className="font-medium">{e.name}</span>}
              <span className="badge">{e.status === "built" ? "built" : "planned"}</span>
              <span className="muted">{e.what} (about {e.approxObjectives} objectives)</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
