// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadImported, loadLessons, mergeLessons } from "../src/services/study/catalog";
import type { StudyImportedFile, StudyLessonsFile } from "../src/domain/types";

function respond(body: string, status: number, contentType: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })));
}

describe("loadLessons", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns null when the lessons file is missing (404)", async () => {
    respond("Not found", 404, "text/plain");
    await expect(loadLessons("missing-404")).resolves.toBeNull();
  });

  it("returns null when the dev server answers a missing file with its HTML page", async () => {
    respond("<!doctype html><html></html>", 200, "text/html");
    await expect(loadLessons("missing-dev")).resolves.toBeNull();
  });

  it("parses a lessons file served as JSON", async () => {
    respond(JSON.stringify({ courseId: "present", lessons: [], scenarios: [] }), 200, "application/json");
    await expect(loadLessons("present")).resolves.toMatchObject({ courseId: "present" });
  });

  it("still reports a server error", async () => {
    respond("boom", 500, "text/plain");
    await expect(loadLessons("broken")).rejects.toThrow("returned 500");
  });
});

describe("imported lessons", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loadImported returns null when no file was imported, under Pages and the dev server alike", async () => {
    respond("Not found", 404, "text/plain");
    await expect(loadImported("none-404")).resolves.toBeNull();
    respond("<!doctype html>", 200, "text/html");
    await expect(loadImported("none-dev")).resolves.toBeNull();
  });

  it("mergeLessons prefers a generated lesson over an imported one for the same objective", () => {
    const imported = { courseId: "c", imported: { source: "ascendra", importedAt: "2026-10-10", models: ["m"] }, lessons: [{ objectiveId: "c:1:1" }, { objectiveId: "c:1:2" }] } as unknown as StudyImportedFile;
    const generated = { courseId: "c", lessons: [{ objectiveId: "c:1:2" }], scenarios: [] } as unknown as StudyLessonsFile;
    const merged = mergeLessons(generated, imported);
    expect(merged.byObjective.get("c:1:1")?.origin).toBe("imported");
    expect(merged.byObjective.get("c:1:2")?.origin).toBe("generated");
    expect(mergeLessons(null, null).byObjective.size).toBe(0);
  });
});
