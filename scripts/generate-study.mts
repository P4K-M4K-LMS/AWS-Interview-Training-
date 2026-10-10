/**
 * Study content tooling. Runs on a developer's machine, never in CI.
 *
 *   npx tsx scripts/generate-study.mts build-catalog
 *       Rebuilds public/study/*.json and src/content/study/missionLinks.ts
 *       from tools/ascendra-catalog and src/content/study/links.ts. No network.
 *
 *   npx tsx scripts/generate-study.mts generate --course saa-c03 [--unit 2] [--limit 5]
 *       [--dry-run] [--force] [--concurrency 4] [--model <id>] [--out <file>]
 *       Generates lessons, question banks and unit scenarios with the
 *       owner's ANTHROPIC_API_KEY into public/study/<course>.lessons.json.
 *       Resumable; regenerates only what is missing or stale unless --force.
 *
 *   npx tsx scripts/generate-study.mts review --course saa-c03
 *       Prints the generator's modality suggestions that differ from the
 *       catalog, for promotion into src/content/study/links.ts by hand.
 *
 *   npx tsx scripts/generate-study.mts validate [--course saa-c03]
 *       Validates committed lessons and imported files against the catalog.
 *
 *   npx tsx scripts/generate-study.mts import --file <export.json|export.csv> [--course saa-c03]
 *       Converts lessons exported from Ascendra's database into
 *       public/study/<course>.imported.json. No network, no key.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildCatalog, missionLinksModule, stableJson } from "./study/catalog.mts";
import { generateCourse, readLessonsFile, reviewTable, usage, usageCost } from "./study/generate.mts";
import { convertRows, readRows } from "./study/importAscendra.mts";
import { lessonsIndex } from "./study/lessonsIndex.mts";
import type { StudyCatalogIndex, StudyCourse, StudyImportedFile, StudyLessonsFile } from "../src/domain/types.ts";
import { validateImportedFile, validateLessonsFile } from "../src/services/study/validate.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "study");
const LINKS_MODULE = path.join(ROOT, "src", "content", "study", "missionLinks.ts");
const FAILURES = path.join(ROOT, "scripts", "study", ".failures.json");
/** One JSON line per generate run: what it made and the tokens it was billed for. Gitignored. */
const USAGE_LOG = path.join(ROOT, "scripts", "study", ".usage.jsonl");
const DEFAULT_MODEL = process.env.STUDY_MODEL ?? process.env.COACH_MODEL ?? "claude-opus-5-5";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
function has(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function buildCatalogCommand(): void {
  const built = buildCatalog();
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".json") && !f.endsWith(".lessons.json") && !f.endsWith(".imported.json")) rmSync(path.join(OUT, f));
  writeFileSync(path.join(OUT, "index.json"), stableJson(built.index));
  writeFileSync(path.join(OUT, "search.json"), JSON.stringify(built.search) + "\n");
  writeLessonsIndex();
  for (const c of built.courses) writeFileSync(path.join(OUT, `${c.id}.json`), stableJson(c));
  const module = missionLinksModule(built);
  let previous = "";
  try {
    previous = readFileSync(LINKS_MODULE, "utf8");
  } catch {
    /* first build */
  }
  if (previous !== module) writeFileSync(LINKS_MODULE, module);
  const objectives = built.index.courses.reduce((a, c) => a + c.counts.objectives, 0);
  const bookkeeping = built.index.courses.reduce((a, c) => a + c.counts.bookkeeping, 0);
  const linked = built.index.courses.reduce((a, c) => a + c.counts.linked, 0);
  console.log(`built ${built.courses.length} courses, ${objectives} objectives (+${bookkeeping} bookkeeping), ${linked} linked to missions, ${Object.keys(built.engineGates).length} planned engines on gates`);
  for (const c of built.index.courses) console.log(`  ${c.id.padEnd(12)} ${String(c.counts.units).padStart(2)} units ${String(c.counts.objectives).padStart(3)} objectives ${String(c.counts.linked).padStart(2)} linked  ${c.title}`);
}

function writeLessonsIndex(): void {
  writeFileSync(path.join(OUT, "lessons-index.json"), stableJson(lessonsIndex(OUT)));
}

function loadCourse(courseId: string): StudyCourse {
  const file = path.join(OUT, `${courseId}.json`);
  if (!existsSync(file)) throw new Error(`no catalog file for course "${courseId}" (run build-catalog; ids are like saa-c03, mscs)`);
  return JSON.parse(readFileSync(file, "utf8")) as StudyCourse;
}

/** Mission ids and titles for the "suggested" field. Loaded dynamically because src/ uses bundler-style imports. */
async function missionList(): Promise<Array<{ id: string; title: string }>> {
  const mod = (await import(pathToFileURL(path.join(ROOT, "src", "content", "missions", "index.ts")).href)) as { MISSIONS: Array<{ id: string; title: string }> };
  return mod.MISSIONS.map((m) => ({ id: m.id, title: m.title }));
}
async function engineList(): Promise<Array<{ id: string; name: string }>> {
  const mod = (await import(pathToFileURL(path.join(ROOT, "src", "content", "study", "engines.ts")).href)) as { ENGINES: Array<{ id: string; name: string }> };
  return mod.ENGINES.map((e) => ({ id: e.id, name: e.name }));
}

async function generateCommand(args: string[]): Promise<void> {
  const courseId = flag(args, "course");
  if (!courseId) throw new Error("generate needs --course <id>");
  const course = loadCourse(courseId);
  const unit = flag(args, "unit");
  const limit = flag(args, "limit");
  const model = flag(args, "model") ?? DEFAULT_MODEL;
  const result = await generateCourse({
    course,
    outFile: flag(args, "out") ?? path.join(OUT, `${courseId}.lessons.json`),
    failuresFile: FAILURES,
    model,
    unit: unit ? Number(unit) : undefined,
    limit: limit ? Number(limit) : undefined,
    concurrency: Number(flag(args, "concurrency") ?? 4),
    force: has(args, "force"),
    dryRun: has(args, "dry-run"),
    missions: await missionList(),
    engines: await engineList(),
    log: (line) => console.log(line),
  });
  if (result.problems.length) {
    console.error(`validation problems in the written file (${result.problems.length}):`);
    for (const p of result.problems.slice(0, 40)) console.error(`  ${p.where}: ${p.message}`);
  }
  console.log(`generated ${result.generated} lesson(s), ${result.scenarios} scenario(s), ${result.failures} failure(s)${result.failures ? ` (see ${path.relative(ROOT, FAILURES)}; re-run to retry)` : ""}`);
  if (usage.calls) {
    const cost = usageCost(model);
    console.log(`usage: ${usage.calls} call(s), ${usage.input} input + ${usage.cacheWrite} cache-write + ${usage.cacheRead} cache-read tokens, ${usage.output} output tokens${cost === undefined ? "" : `, about $${cost.toFixed(2)} at list price`}`);
    appendFileSync(USAGE_LOG, JSON.stringify({ at: new Date().toISOString(), course: course.id, model, lessons: result.generated, scenarios: result.scenarios, failures: result.failures, ...usage, ...(cost === undefined ? {} : { cost: Number(cost.toFixed(4)) }) }) + "\n");
  }
  if (!has(args, "dry-run")) writeLessonsIndex();
  if (result.failures || result.problems.length) process.exitCode = 1;
}

function reviewCommand(args: string[]): void {
  const courseId = flag(args, "course");
  if (!courseId) throw new Error("review needs --course <id>");
  const course = loadCourse(courseId);
  const file = readLessonsFile(path.join(OUT, `${courseId}.lessons.json`), courseId);
  const rows = reviewTable(file, course);
  console.log(`${file.lessons.length} lesson(s), ${rows.length} suggestion(s) that differ from the catalog:`);
  console.log("objective\tcatalog -> suggested\tobjective text\trationale");
  for (const r of rows) console.log(r);
}

function validateCommand(args: string[]): void {
  const only = flag(args, "course");
  const files = readdirSync(OUT).filter((f) => /\.(lessons|imported)\.json$/.test(f) && (!only || f.startsWith(`${only}.`)));
  let bad = 0;
  for (const f of files) {
    const courseId = f.replace(/\.(lessons|imported)\.json$/, "");
    const course = loadCourse(courseId);
    let problems;
    if (f.endsWith(".imported.json")) {
      const file = JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as StudyImportedFile;
      problems = validateImportedFile(file, course);
      console.log(`${f}: ${file.lessons.length} imported lessons, ${problems.length} problem(s)`);
    } else {
      const file = JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as StudyLessonsFile;
      problems = validateLessonsFile(file, course);
      console.log(`${f}: ${file.lessons.length} lessons, ${file.scenarios.length} scenarios, ${problems.length} problem(s)`);
    }
    for (const p of problems.slice(0, 40)) console.log(`  ${p.where}: ${p.message}`);
    bad += problems.length;
  }
  if (!files.length) console.log("no lessons or imported files committed yet");
  if (bad) process.exitCode = 1;
}

function importCommand(args: string[]): void {
  const file = flag(args, "file");
  if (!file) throw new Error("import needs --file <export.json|export.csv> (see docs/STUDY_GENERATION.md for the export query)");
  const only = flag(args, "course");
  const index = JSON.parse(readFileSync(path.join(OUT, "index.json"), "utf8")) as StudyCatalogIndex;
  const courses = index.courses.filter((c) => !only || c.id === only).map((c) => loadCourse(c.id));
  if (only && !courses.length) throw new Error(`no catalog course "${only}"`);
  const rows = readRows(readFileSync(path.resolve(file), "utf8"));
  const { files, report } = convertRows(rows, courses, new Date().toISOString().slice(0, 10));
  for (const f of files) {
    writeFileSync(path.join(OUT, `${f.courseId}.imported.json`), stableJson(f));
    const learnable = courses.find((c) => c.id === f.courseId)!.units.flatMap((u) => u.objectives).filter((o) => o.kind === "objective").length;
    console.log(`  ${f.courseId.padEnd(12)} ${String(f.lessons.length).padStart(3)} of ${learnable} objectives`);
  }
  writeLessonsIndex();
  console.log(`read ${report.rows} row(s): imported ${report.imported} lesson(s) into ${files.length} course file(s); ${report.duplicates} duplicate row(s) collapsed to the newest`);
  const other = Object.entries(report.otherCourses);
  if (other.length) console.log(`skipped ${other.reduce((a, [, n]) => a + n, 0)} row(s) for courses outside the catalog${only ? " or --course" : ""}: ${other.map(([c, n]) => `${c} (${n})`).join(", ")}`);
  if (report.unmatched.length) {
    console.log(`${report.unmatched.length} row(s) matched no objective text (the catalog may have changed since Ascendra wrote them):`);
    for (const u of report.unmatched.slice(0, 20)) console.log(`  ${u.course}: ${u.objective}`);
  }
  if (report.invalid.length) {
    console.log(`${report.invalid.length} problem(s) in rows left out:`);
    for (const p of report.invalid.slice(0, 20)) console.log(`  ${p.where}: ${p.message}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  switch (command) {
    case "build-catalog":
      buildCatalogCommand();
      break;
    case "generate":
      await generateCommand(rest);
      break;
    case "review":
      reviewCommand(rest);
      break;
    case "validate":
      validateCommand(rest);
      break;
    case "import":
      importCommand(rest);
      break;
    case "index-lessons":
      writeLessonsIndex();
      break;
    default:
      console.error("usage: npx tsx scripts/generate-study.mts <build-catalog|generate|review|validate|import|index-lessons> [options]");
      process.exit(2);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
