/**
 * public/study/lessons-index.json: how many generated and imported lessons
 * each course has, so the Study home can show it without fetching every
 * lessons file. Rewritten by build-catalog, generate and import; a test
 * checks it matches the files on disk.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { StudyLessonsIndex } from "../../src/domain/types.ts";

export function lessonsIndex(dir: string): StudyLessonsIndex {
  const courses: StudyLessonsIndex["courses"] = {};
  for (const f of readdirSync(dir).sort()) {
    const m = /^(.+)\.(lessons|imported)\.json$/.exec(f);
    if (!m) continue;
    const row = (courses[m[1]] ??= { generated: 0, imported: 0, scenarios: 0 });
    const file = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { lessons: unknown[]; scenarios?: unknown[] };
    if (m[2] === "lessons") {
      row.generated = file.lessons.length;
      row.scenarios = file.scenarios?.length ?? 0;
    } else row.imported = file.lessons.length;
  }
  return { schemaVersion: 1, courses };
}
