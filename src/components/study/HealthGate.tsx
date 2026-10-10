import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Callout, PageHeader } from "../ui";
import { HEALTH_DISCLAIMERS } from "../../content/study/healthDisclaimers";
import { updateProfile } from "../../data/db";
import { useProfile } from "../../data/hooks";
import type { StudyCourse } from "../../domain/types";

/**
 * Nursing and physical therapy courses show nothing until the learner accepts
 * the field's disclaimer. Acceptance is stored per field and version in the
 * learner's settings, so a reworded disclaimer asks again.
 */
export function HealthGate({ course, children }: { course: Pick<StudyCourse, "title" | "field" | "requiresAcknowledgement">; children: ReactNode }) {
  const profile = useProfile();
  const key = course.field === "nursing" || course.field === "pt" ? course.field : undefined;
  if (!course.requiresAcknowledgement || !key) return <>{children}</>;
  if (!profile) return <p className="muted text-sm">Loading…</p>;
  const d = HEALTH_DISCLAIMERS[key];
  const accepted = profile.settings.studyAcknowledgements?.[key] ?? 0;
  if (accepted >= d.version) return <>{children}</>;
  const accept = () => void updateProfile({ settings: { ...profile.settings, studyAcknowledgements: { ...profile.settings.studyAcknowledgements, [key]: d.version } } });
  return (
    <div className="space-y-5 max-w-2xl" data-testid="study-health-gate">
      <PageHeader title={course.title} subtitle={<Link to="/study" className="underline">Study</Link>} />
      <Callout kind="warn" title={d.title}>
        <p className="font-medium">{d.summary}</p>
        {d.body.map((p) => (
          <p key={p} className="mt-2">{p}</p>
        ))}
      </Callout>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={accept} data-testid="study-health-accept">
          {d.acceptLabel}
        </button>
        <Link to="/study" className="btn-secondary">Not now</Link>
      </div>
    </div>
  );
}
