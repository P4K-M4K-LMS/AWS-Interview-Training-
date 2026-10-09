import { useEffect, useState } from "react";
import type { StudyCatalogIndex, StudyCourse } from "../../domain/types";

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

export async function loadCourse(courseId: string): Promise<StudyCourse> {
  if (!/^[a-z0-9-]+$/.test(courseId)) throw new Error("Study catalog: bad course id");
  return fetchJson<StudyCourse>(`${courseId}.json`);
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

export function useStudyCourse(courseId: string | undefined): Loaded<StudyCourse> {
  return useLoaded(courseId ? () => loadCourse(courseId) : null, courseId ?? "");
}

/** Test seam: forget everything fetched so far. */
export function resetStudyCache(): void {
  cache.clear();
}
