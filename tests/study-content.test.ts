import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateImportedFile, validateLessonsFile } from "../src/services/study/validate";
import { stableJson } from "../scripts/study/catalog.mts";
import { lessonsIndex } from "../scripts/study/lessonsIndex.mts";
import type { StudyCourse, StudyImportedFile, StudyLessonsFile } from "../src/domain/types";

const OUT = path.resolve(__dirname, "..", "public", "study");
const files = readdirSync(OUT).filter((f) => f.endsWith(".lessons.json"));
const importedFiles = readdirSync(OUT).filter((f) => f.endsWith(".imported.json"));

describe("committed Study lessons", () => {
  it("every committed lessons file validates against its course and stays under the size limit", () => {
    for (const f of files) {
      const courseId = f.replace(/\.lessons\.json$/, "");
      const course = JSON.parse(readFileSync(path.join(OUT, `${courseId}.json`), "utf8")) as StudyCourse;
      const lessons = JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as StudyLessonsFile;
      const problems = validateLessonsFile(lessons, course);
      expect(problems, `${f}: ${problems.slice(0, 5).map((p) => `${p.where}: ${p.message}`).join("; ")}`).toEqual([]);
      expect(statSync(path.join(OUT, f)).size, `${f} too large; split per unit`).toBeLessThan(1_500_000);
    }
  });

  it("every committed file of lessons imported from Ascendra validates against its course", () => {
    for (const f of importedFiles) {
      const courseId = f.replace(/\.imported\.json$/, "");
      const course = JSON.parse(readFileSync(path.join(OUT, `${courseId}.json`), "utf8")) as StudyCourse;
      const imported = JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as StudyImportedFile;
      const problems = validateImportedFile(imported, course);
      expect(problems, `${f}: ${problems.slice(0, 5).map((p) => `${p.where}: ${p.message}`).join("; ")}`).toEqual([]);
      expect(statSync(path.join(OUT, f)).size, `${f} too large`).toBeLessThan(1_500_000);
    }
  });

  it("knows which courses have lessons (none until generated locally)", () => {
    // Informational: the list grows as the owner generates courses. Nothing to assert beyond shape.
    for (const f of files) expect(f).toMatch(/^[a-z0-9-]+\.lessons\.json$/);
  });
});

describe("lessons index", () => {
  it("matches the lessons and imported files on disk (run `npx tsx scripts/generate-study.mts index-lessons`)", () => {
    expect(readFileSync(path.join(OUT, "lessons-index.json"), "utf8")).toBe(stableJson(lessonsIndex(OUT)));
  });
});
