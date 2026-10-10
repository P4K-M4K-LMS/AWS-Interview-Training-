import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertRows, parseCsv, readRows, type AscendraRow } from "../scripts/study/importAscendra.mts";
import { validateImportedFile } from "../src/services/study/validate";
import type { StudyCourse } from "../src/domain/types";

const OUT = path.resolve(__dirname, "..", "public", "study");
const saa = JSON.parse(readFileSync(path.join(OUT, "saa-c03.json"), "utf8")) as StudyCourse;
const first = saa.units[0].objectives[0];
const second = saa.units[0].objectives[1];

function row(over: Partial<AscendraRow> = {}): AscendraRow {
  return {
    course_code: "SAA-C03",
    unit_order: 0,
    unit_title: saa.units[0].title,
    objective_order: 0,
    objective: first.text,
    guess_prompt: "What do you think should protect the most powerful account?",
    teach: "The root user can do anything, so it gets MFA and is locked away; daily work uses roles with least privilege.",
    fade_problem: "Root has full access. Step 1: enable MFA. Step 2: ___. What fills step 2?",
    fade_choices: ["Stop using root for daily work", "Share the root password", "Delete all users", "Disable logging"],
    fade_correct_index: 0,
    fade_why: "Root stays locked away once MFA is on; people use their own identities.",
    solo_check: "Which is the safest daily practice?",
    solo_choices: ["Use the root user", "Use a role with only the permissions needed", "Use one shared admin user", "Turn off MFA"],
    solo_correct_index: 1,
    solo_why: "Least privilege through roles limits what a mistake or a stolen credential can do.",
    model: "claude-test",
    generated_at: "2026-03-01 12:00:00+00",
    ...over,
  };
}

describe("Ascendra lesson import", () => {
  it("converts a matching row into a valid imported lesson keyed on the catalog's id and hash", () => {
    const { files, report } = convertRows([row()], [saa], "2026-10-10");
    expect(report).toMatchObject({ rows: 1, imported: 1, duplicates: 0, unmatched: [], invalid: [] });
    expect(files).toHaveLength(1);
    const lesson = files[0].lessons[0];
    expect(lesson.objectiveId).toBe(first.id);
    expect(lesson.sourceHash).toBe(first.sourceHash);
    expect(lesson.questions.map((q) => [q.id, q.role])).toEqual([
      [`${first.id}:q1`, "fade"],
      [`${first.id}:q2`, "solo"],
    ]);
    expect(lesson.generatedAt).toBe("2026-03-01T12:00:00.000Z");
    expect(files[0].imported).toEqual({ source: "ascendra", importedAt: "2026-10-10", models: ["claude-test"] });
    expect(validateImportedFile(files[0], saa)).toEqual([]);
  });

  it("matches objective text regardless of case and spacing, and keeps the newest of duplicate rows", () => {
    const older = row({ teach: "Older teaching text about the root user and MFA, kept only if nothing newer exists.", generated_at: "2026-01-01T00:00:00Z" });
    const newer = row({ objective: `  ${first.text.toUpperCase()}  `, generated_at: "2026-05-01T00:00:00Z" });
    const { files, report } = convertRows([newer, older], [saa], "2026-10-10");
    expect(report.duplicates).toBe(1);
    expect(files[0].lessons).toHaveLength(1);
    expect(files[0].lessons[0].generatedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("reports rows for other courses, unknown objective text and broken questions, and imports the rest", () => {
    const rows = [
      row(),
      row({ course_code: "SECPLUS" }),
      row({ objective: "An objective the catalog never had" }),
      row({ objective: second.text, solo_choices: ["only", "three", "choices"] }),
    ];
    const { files, report } = convertRows(rows, [saa], "2026-10-10");
    expect(report.imported).toBe(1);
    expect(report.otherCourses).toEqual({ SECPLUS: 1 });
    expect(report.unmatched).toEqual([{ course: "saa-c03", objective: "An objective the catalog never had" }]);
    expect(report.invalid.map((p) => p.message)).toContain("need 4 non-empty choices");
    expect(files[0].lessons.map((l) => l.objectiveId)).toEqual([first.id]);
  });

  it("reads Supabase's CSV download, where choices arrive as JSON text and fields can hold commas, quotes and newlines", () => {
    const r = row();
    const header = Object.keys(r);
    const cell = (v: unknown) => `"${(Array.isArray(v) ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`;
    const csv = `${header.join(",")}\r\n${header.map((h) => cell(h === "teach" ? `Line one, with a comma.\nLine "two".` : (r as unknown as Record<string, unknown>)[h])).join(",")}\r\n`;
    const rows = readRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].teach).toBe(`Line one, with a comma.\nLine "two".`);
    const { files, report } = convertRows(rows, [saa], "2026-10-10");
    expect(report.invalid).toEqual([]);
    expect(files[0].lessons[0].questions[1].choices[1]).toBe("Use a role with only the permissions needed");
    expect(files[0].lessons[0].questions[0].correctIndex).toBe(0);
  });

  it("reads Supabase's JSON download", () => {
    expect(readRows(JSON.stringify([row()]))[0].course_code).toBe("SAA-C03");
  });

  it("parses CSV edge cases", () => {
    expect(parseCsv('a,b\n"x,1","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x,1", 'say "hi"'],
    ]);
  });
});
