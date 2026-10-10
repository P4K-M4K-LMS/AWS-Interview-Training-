/**
 * Converts lessons exported from Ascendra's database (its lesson_content
 * table, joined to objective, unit and course; query in
 * docs/STUDY_GENERATION.md) into public/study/<course>.imported.json.
 *
 * Rows are matched to catalog objectives by course code and objective text,
 * not by Ascendra's uuids, so the files stay keyed on OpsForge's own ids and
 * source hashes. Rows that do not match, belong to a course outside the
 * catalog, or fail validation are reported and left out; one bad row never
 * blocks the rest.
 */
import type { StudyChoiceQuestion, StudyCourse, StudyImportedFile, StudyImportedLesson } from "../../src/domain/types.ts";
import { validateImportedLesson, type Problem } from "../../src/services/study/validate.ts";

/** One row of the export, as Supabase's SQL editor downloads it (JSON or CSV). */
export interface AscendraRow {
  course_code: string;
  unit_order?: number | string;
  unit_title?: string;
  objective_order?: number | string;
  objective: string;
  guess_prompt: string;
  teach: string;
  fade_problem: string;
  fade_choices: string[] | string;
  fade_correct_index: number | string;
  fade_why: string;
  solo_check: string;
  solo_choices: string[] | string;
  solo_correct_index: number | string;
  solo_why: string;
  model: string;
  generated_at: string;
}

export interface ImportReport {
  rows: number;
  imported: number;
  duplicates: number;
  /** Course codes in the export that are not in the catalog, with their row counts. */
  otherCourses: Record<string, number>;
  unmatched: Array<{ course: string; objective: string }>;
  invalid: Problem[];
}

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** Reads the export file's text: a JSON array of objects, or CSV with a header row. */
export function readRows(text: string): AscendraRow[] {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed) as AscendraRow[];
  const [header, ...body] = parseCsv(trimmed);
  if (!header) return [];
  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h.trim(), cells[i] ?? ""])) as unknown as AscendraRow);
}

export function normaliseText(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function choices(v: string[] | string): string[] {
  if (Array.isArray(v)) return v.map(String);
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isoDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v ?? "") : d.toISOString();
}

export function convertRows(rows: AscendraRow[], courses: StudyCourse[], importedAt: string): { files: StudyImportedFile[]; report: ImportReport } {
  const report: ImportReport = { rows: rows.length, imported: 0, duplicates: 0, otherCourses: {}, unmatched: [], invalid: [] };
  // Ascendra exports its track code (AWSSAA); our ids use the exam code (saa-c03). Accept either.
  const byCourse = new Map(courses.flatMap((c) => [[c.id, c], [c.code.toLowerCase(), c]] as const));
  const picked = new Map<string, Map<string, StudyImportedLesson>>();
  for (const row of rows) {
    let courseId = String(row.course_code ?? "").trim().toLowerCase();
    const course = byCourse.get(courseId);
    if (course) courseId = course.id;
    if (!course) {
      report.otherCourses[row.course_code] = (report.otherCourses[row.course_code] ?? 0) + 1;
      continue;
    }
    const text = normaliseText(String(row.objective ?? ""));
    const candidates = course.units.flatMap((u) => u.objectives.filter((o) => normaliseText(o.text) === text).map((o) => ({ o, u })));
    // The same line can appear in two units; the unit title decides.
    const hit = candidates.length > 1 ? (candidates.find((c) => row.unit_title && normaliseText(c.u.title) === normaliseText(row.unit_title)) ?? candidates[0]) : candidates[0];
    if (!hit) {
      report.unmatched.push({ course: courseId, objective: row.objective });
      continue;
    }
    const objectiveId = hit.o.id;
    const questions: StudyChoiceQuestion[] = [
      { id: `${objectiveId}:q1`, role: "fade", prompt: row.fade_problem, choices: choices(row.fade_choices), correctIndex: Number(row.fade_correct_index), why: row.fade_why },
      { id: `${objectiveId}:q2`, role: "solo", prompt: row.solo_check, choices: choices(row.solo_choices), correctIndex: Number(row.solo_correct_index), why: row.solo_why },
    ];
    const lesson: StudyImportedLesson = { objectiveId, sourceHash: hit.o.sourceHash, model: String(row.model ?? ""), generatedAt: isoDate(row.generated_at), guessPrompt: row.guess_prompt, teach: row.teach, questions };
    const problems: Problem[] = [];
    validateImportedLesson(lesson, course, problems);
    if (problems.length) {
      report.invalid.push(...problems);
      continue;
    }
    const lessons = picked.get(courseId) ?? new Map<string, StudyImportedLesson>();
    picked.set(courseId, lessons);
    const existing = lessons.get(objectiveId);
    if (existing) {
      report.duplicates++;
      if (existing.generatedAt >= lesson.generatedAt) continue;
    }
    lessons.set(objectiveId, lesson);
  }
  const files: StudyImportedFile[] = [];
  for (const [courseId, lessons] of [...picked].sort(([a], [b]) => a.localeCompare(b))) {
    const course = byCourse.get(courseId)!;
    const order = new Map(course.units.flatMap((u) => u.objectives).map((o, i) => [o.id, i]));
    const list = [...lessons.values()].sort((a, b) => (order.get(a.objectiveId) ?? 0) - (order.get(b.objectiveId) ?? 0));
    report.imported += list.length;
    files.push({ courseId, imported: { source: "ascendra", importedAt, models: [...new Set(list.map((l) => l.model))].sort() }, lessons: list });
  }
  return { files, report };
}
