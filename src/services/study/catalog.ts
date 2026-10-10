import { useEffect, useState } from "react";
import type { PlayableLesson, StudyCatalogIndex, StudyCourse, StudyImportedFile, StudyLessonsFile, StudyLessonsIndex, StudySearchIndex } from "../../domain/types";

/**
 * Loads the Study catalog JSON from public/study on demand and memoises it
 * for the session. Nothing here enters the JavaScript bundle; a course is
 * fetched the first time its page opens. The base path is Vite's so the
 * files resolve under /<repo>/ on GitHub Pages as well as locally.
 */
const base = `${import.meta.env.BASE_URL}study/`;
const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(file: string): Promise<T> {
  const key = file;
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${base}${file}`).then(async (r) => {
      if (!r.ok) throw new Error(`Study catalog: ${file} returned ${r.status}`);
      return (await r.json()) as T;
    });
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export function loadIndex(): Promise<StudyCatalogIndex> {
  return fetchJson<StudyCatalogIndex>("index.json");
}

/** Lesson counts per course; an empty index when the file is missing (a deploy before it existed). */
export async function loadLessonsIndex(): Promise<StudyLessonsIndex> {
  return (await fetchOptional<StudyLessonsIndex>("lessons-index.json")) ?? { schemaVersion: 1, courses: {} };
}

/** Every objective's text. About 450 KB, so only fetched once the learner types a search. */
export function loadSearchIndex(): Promise<StudySearchIndex> {
  return fetchJson<StudySearchIndex>("search.json");
}

export async function loadCourse(courseId: string): Promise<StudyCourse> {
  if (!/^[a-z0-9-]+$/.test(courseId)) throw new Error("Study catalog: bad course id");
  return fetchJson<StudyCourse>(`${courseId}.json`);
}

/** A file that may not exist yet: null on a 404, or on the dev server's HTML fallback. */
function fetchOptional<T>(file: string): Promise<T | null> {
  let p = cache.get(file) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(`${base}${file}`).then(async (r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`Study lessons: ${file} returned ${r.status}`);
      // Vite's dev server answers a missing file with the app's HTML page and a 200, not a 404.
      if (!(r.headers.get("content-type") ?? "").includes("json")) return null;
      return (await r.json()) as T;
    });
    cache.set(file, p);
    p.catch(() => cache.delete(file));
  }
  return p;
}

/** Generated lessons for a course; null when none have been generated yet (404, or the dev server's HTML fallback). */
export async function loadLessons(courseId: string): Promise<StudyLessonsFile | null> {
  if (!/^[a-z0-9-]+$/.test(courseId)) throw new Error("Study catalog: bad course id");
  return fetchOptional<StudyLessonsFile>(`${courseId}.lessons.json`);
}

/** Lessons imported from Ascendra's database; null when none were imported for this course. */
export async function loadImported(courseId: string): Promise<StudyImportedFile | null> {
  if (!/^[a-z0-9-]+$/.test(courseId)) throw new Error("Study catalog: bad course id");
  return fetchOptional<StudyImportedFile>(`${courseId}.imported.json`);
}

export interface CourseLessons {
  generated: StudyLessonsFile | null;
  imported: StudyImportedFile | null;
  /** One playable lesson per objective: the generated one when it exists, otherwise the imported one. */
  byObjective: Map<string, PlayableLesson>;
}

export function mergeLessons(generated: StudyLessonsFile | null, imported: StudyImportedFile | null): CourseLessons {
  const byObjective = new Map<string, PlayableLesson>();
  for (const l of imported?.lessons ?? []) byObjective.set(l.objectiveId, { origin: "imported", ...l });
  for (const l of generated?.lessons ?? []) byObjective.set(l.objectiveId, { origin: "generated", ...l });
  return { generated, imported, byObjective };
}

export async function loadCourseLessons(courseId: string): Promise<CourseLessons> {
  const [generated, imported] = await Promise.all([loadLessons(courseId), loadImported(courseId)]);
  return mergeLessons(generated, imported);
}

export type Loaded<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

function useLoaded<T>(load: (() => Promise<T>) | null, key: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    if (!load) return;
    load().then(
      (data) => live && setState({ status: "ready", data }),
      (err: unknown) => live && setState({ status: "error", message: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
    // `key` stands in for the loader identity; the loader closes over the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useStudyIndex(): Loaded<StudyCatalogIndex> {
  return useLoaded(loadIndex, "index");
}

export function useLessonsIndex(): Loaded<StudyLessonsIndex> {
  return useLoaded(loadLessonsIndex, "lessons-index");
}

/** Null until `enabled`, so the search file is not fetched for learners who never search. */
export function useSearchIndex(enabled: boolean): Loaded<StudySearchIndex> {
  return useLoaded(enabled ? loadSearchIndex : null, enabled ? "search" : "");
}

export function useStudyCourse(courseId: string | undefined): Loaded<StudyCourse> {
  return useLoaded(courseId ? () => loadCourse(courseId) : null, courseId ?? "");
}

export function useCourseLessons(courseId: string | undefined): Loaded<CourseLessons> {
  return useLoaded(courseId ? () => loadCourseLessons(courseId) : null, `${courseId ?? ""}.lessons`);
}

/** Test seam: forget everything fetched so far. */
export function resetStudyCache(): void {
  cache.clear();
}
