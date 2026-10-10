/**
 * The disclaimer a learner accepts before any nursing or physical therapy
 * lesson is shown, adapted from Ascendra's (mobile/src/content/disclaimers.ts).
 * Bump `version` when the meaning changes, not for a typo: everyone who
 * accepted an older version is asked again, and being asked again for a comma
 * teaches people to click through without reading.
 */
export interface HealthDisclaimer {
  version: number;
  title: string;
  summary: string;
  body: string[];
  acceptLabel: string;
}

const COMMON_SUMMARY = "This is exam preparation. It is not clinical guidance, and it must not be used to make decisions about a real patient.";

export const HEALTH_DISCLAIMERS: Record<"nursing" | "pt", HealthDisclaimer> = {
  nursing: {
    version: 1,
    title: "Before you start this course",
    summary: COMMON_SUMMARY,
    body: [
      "OpsForge's lessons are machine-written from published examination blueprints to prepare you for a test. They are not reviewed by a licensed clinician, they are not a care protocol, and they can be wrong.",
      "Nursing practice is governed by your licence, your employer's policies and the scope of practice in your jurisdiction. Where anything here differs from those, they win, every time, without exception.",
      "Never act at the bedside on something you read here. If a lesson conflicts with your instructor, your facility's policy, a current drug reference or a provider's order, treat this course as the thing that is wrong and raise it with them.",
      "Drug dosages, laboratory values and emergency procedures change. Verify anything you intend to rely on against a current authoritative source before you use it.",
      "If you are facing a real clinical emergency, stop and follow your facility's emergency procedure.",
    ],
    acceptLabel: "I understand, start the course",
  },
  pt: {
    version: 1,
    title: "Before you start this course",
    summary: COMMON_SUMMARY,
    body: [
      "OpsForge's lessons are machine-written from published examination content outlines to prepare you for a test. They are not reviewed by a licensed clinician, they are not a treatment protocol, and they can be wrong.",
      "Physical therapy practice is governed by your licence, your employer's policies and the scope of practice in your jurisdiction. Where anything here differs from those, they win, every time, without exception.",
      "Never act in patient care on something you read here. If a lesson conflicts with your instructor, your facility's policy or a supervising clinician's judgment, treat this course as the thing that is wrong and raise it with them.",
      "Contraindications, precautions and intervention techniques change as evidence evolves. Verify anything you intend to rely on against a current authoritative source before you use it.",
      "If you are facing a real clinical emergency, stop and follow your facility's emergency procedure.",
    ],
    acceptLabel: "I understand, start the course",
  },
};
