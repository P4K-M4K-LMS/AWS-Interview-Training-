// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLessons } from "../src/services/study/catalog";

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
