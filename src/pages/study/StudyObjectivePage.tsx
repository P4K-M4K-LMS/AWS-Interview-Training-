import { Link, useParams, useSearchParams } from "react-router-dom";
import { HealthGate } from "../../components/study/HealthGate";
import { Callout, EmptyState, PageHeader } from "../../components/ui";
import { LessonLoopPlayer } from "../../components/study/LessonLoopPlayer";
import { MISSION_BY_ID } from "../../content/missions";
import { MODALITY_HELP, MODALITY_LABELS } from "../../content/study/links";
import { LAB_LABELS, labExercisePath } from "../../content/study/labs";
import { useProfile, useStudyStates } from "../../data/hooks";
import { effectiveExplanationLevel } from "../../engine/learner/explanation";
import { useCourseLessons, useStudyCourse } from "../../services/study/catalog";
import { DEFAULT_SETTINGS } from "../../data/db";

/** One objective: its lesson loop when generated content exists, otherwise what to do instead. */
export function StudyObjectivePage() {
  const { courseId, unitIndex, objectiveIndex } = useParams();
  const [params] = useSearchParams();
  const course = useStudyCourse(courseId);
  const lessons = useCourseLessons(courseId);
  const states = useStudyStates();
  const profile = useProfile();
  if (course.status === "loading" || lessons.status === "loading") return <p className="muted text-sm">Loading…</p>;
  if (course.status === "error") {
    return (
      <Callout kind="danger" title="Course not found">
        {course.message}. <Link to="/study" className="underline">Back to Study</Link>.
      </Callout>
    );
  }
  const c = course.data;
  const unit = c.units.find((u) => u.index === Number(unitIndex));
  const objective = unit?.objectives.find((o) => o.index === Number(objectiveIndex));
  if (!unit || !objective) return <EmptyState title="Objective not found" body="This unit has no objective with that number." cta={{ to: `/study/${c.id}`, label: `Back to ${c.title}` }} />;
  const lesson = lessons.status === "ready" ? lessons.data.byObjective.get(objective.id) : undefined;
  const mission = objective.link?.kind === "mission" ? MISSION_BY_ID.get(objective.link.missionId) : undefined;
  const state = states.get(objective.id);
  const review = params.get("review") === "1" && Boolean(state?.nextReviewAt);
  return (
    <HealthGate course={c}>
      <div className="space-y-4">
        <PageHeader
          title={objective.text}
          subtitle={
            <>
              <Link to="/study" className="underline">Study</Link> · <Link to={`/study/${c.id}`} className="underline">{c.title}</Link> · <Link to={`/study/${c.id}/${unit.index}`} className="underline">{unit.index}. {unit.title}</Link> · objective {objective.index}
            </>
          }
        />
        <p className="text-xs">
          <span className="badge mr-2">{MODALITY_LABELS[objective.modality]}</span>
          <span className="muted">{MODALITY_HELP[objective.modality]}</span>
        </p>
        {objective.kind === "bookkeeping" ? (
          <Callout kind="info" title="Degree-plan line">
            This is a requirement from the degree plan, not something to learn here. It never gets a lesson or a status.
          </Callout>
        ) : lessons.status === "error" ? (
          <Callout kind="danger" title="Lessons did not load">
            {lessons.message}
          </Callout>
        ) : lesson ? (
          <LessonLoopPlayer key={`${objective.id}:${lesson.origin}`} objective={objective} lesson={lesson} state={state} level={effectiveExplanationLevel(profile)} review={review} generatedBy={{ model: lesson.model, generatedAt: lesson.generatedAt }} settings={profile?.settings ?? DEFAULT_SETTINGS} />
        ) : (
          <Callout kind="warn" title="No lesson generated yet">
            <span data-testid="no-lesson">The owner has not generated this course's lessons yet (see docs/STUDY_GENERATION.md).</span>
            {mission ? (
              <p className="mt-2">
                You can still do it: <Link to={`/missions/${mission.id}?from=${encodeURIComponent(objective.id)}`} className="underline">{mission.title}</Link> credits this objective.
              </p>
            ) : objective.link?.kind === "lab" ? (
              <p className="mt-2">
                You can still do it: <Link to={labExercisePath(objective.link, objective.id)} className="underline">{LAB_LABELS[objective.link.labId] ?? objective.link.labId}</Link> credits this objective.
              </p>
            ) : (
              <p className="mt-2">Until then, this objective is a catalog entry. The source objective text above is the whole of it.</p>
            )}
          </Callout>
        )}
      </div>
    </HealthGate>
  );
}
