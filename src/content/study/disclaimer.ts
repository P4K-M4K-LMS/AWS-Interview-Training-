/**
 * Shown on the Study home, on every course page and under every lesson.
 * The catalog is Ascendra's paraphrase of public exam guides; nothing here is
 * official, affiliated or endorsed, and studying it is not a credential.
 */
export const STUDY_DISCLAIMER =
  "Study material is unofficial. The objectives are paraphrased from publicly published exam guides and degree plans; the lessons are machine-written and spot-checked, not reviewed by any vendor. OpsForge is not affiliated with or endorsed by any certification body, and finishing a course here is not a certification, a credit or a qualification. Objective status in Study is separate from skill mastery, which still comes only from missions.";

/** Exam-revision notes worth a badge, keyed by exam code. Dates from the source files. */
export function examChurnNote(status: string | undefined, retirementDate: string | undefined, examCode: string | undefined): string | undefined {
  if (!status || status === "active") return undefined;
  if (status === "transitioning") return retirementDate ? `${examCode ?? "This exam"} is being replaced; last day ${retirementDate}.` : `${examCode ?? "This exam"} is being replaced by a newer revision.`;
  if (status === "retired") return `${examCode ?? "This exam"} has been retired.`;
  if (status === "beta") return `${examCode ?? "This exam"} is in beta; objectives may change.`;
  return undefined;
}
