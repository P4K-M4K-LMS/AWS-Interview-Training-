/**
 * Study content tooling. Runs on a developer's machine, never in CI.
 *
 *   npx tsx scripts/generate-study.mts build-catalog
 *       Rebuilds public/study/*.json and src/content/study/missionLinks.ts
 *       from tools/ascendra-catalog and src/content/study/links.ts. No network.
 *
 *   npx tsx scripts/generate-study.mts generate --course saa-c03 [--dry-run]
 *       Generates lessons with the owner's ANTHROPIC_API_KEY. Lands in the
 *       next slice; today it explains that and exits.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCatalog, missionLinksModule, stableJson } from "./study/catalog.mts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "study");
const LINKS_MODULE = path.join(ROOT, "src", "content", "study", "missionLinks.ts");

function buildCatalogCommand(): void {
  const built = buildCatalog();
  mkdirSync(OUT, { recursive: true });
  // Remove stale course files (not lessons) so a dropped course disappears.
  for (const f of readdirSync(OUT)) if (f.endsWith(".json") && !f.endsWith(".lessons.json")) rmSync(path.join(OUT, f));
  writeFileSync(path.join(OUT, "index.json"), stableJson(built.index));
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

const [command] = process.argv.slice(2);
switch (command) {
  case "build-catalog":
    buildCatalogCommand();
    break;
  case "generate":
    console.error("generate: lesson generation is not in this build yet (see docs/STUDY_GENERATION.md once it lands). The catalog browse works without it.");
    process.exit(2);
    break;
  default:
    console.error("usage: npx tsx scripts/generate-study.mts <build-catalog|generate> [options]");
    process.exit(2);
}
