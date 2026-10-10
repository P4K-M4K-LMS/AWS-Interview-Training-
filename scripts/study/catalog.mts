/**
 * Pure catalog build: Ascendra seed tracks -> OpsForge Study JSON. No I/O and
 * no API calls, so the unit test can rebuild in memory and diff against the
 * committed files. The CLI wrapper in scripts/generate-study.mts writes them.
 */
import { createHash } from "node:crypto";
import type { SeedTrack, SeedUnit } from "../../tools/ascendra-catalog/data.ts";
import {
  CMPCBS_TRACK,
  CYSAPLUS_TRACK,
  JAVASCRIPT_TRACK,
  LINUXPLUS_TRACK,
  MSCS_TRACK,
  PENTESTPLUS_TRACK,
  PYTHON_TRACK,
  SECPLUS_TRACK,
  SECURITYX_TRACK,
} from "../../tools/ascendra-catalog/data.ts";
import { AWS_TRACKS } from "../../tools/ascendra-catalog/tracks/aws.ts";
import { AZURE_TRACKS } from "../../tools/ascendra-catalog/tracks/azure.ts";
import { COMPTIA_TRACKS } from "../../tools/ascendra-catalog/tracks/comptia.ts";
import { FITNESS_TRACKS } from "../../tools/ascendra-catalog/tracks/fitness.ts";
import { GCP_TRACKS } from "../../tools/ascendra-catalog/tracks/gcp.ts";
import { NURSING_TRACKS } from "../../tools/ascendra-catalog/tracks/nursing.ts";
import { PM_TRACKS } from "../../tools/ascendra-catalog/tracks/pm.ts";
import { PT_TRACKS } from "../../tools/ascendra-catalog/tracks/pt.ts";
import { BOOKKEEPING_UNITS, STUDY_LAB_LINKS, STUDY_LINKS, UNIT_ENGINE_GATES } from "../../src/content/study/links.ts";
import { PATHS, PLACEMENT } from "../../src/content/study/paths.ts";
import type { StudyCatalogIndex, StudyCourse, StudySearchIndex, StudyCourseSummary, StudyModality, StudyObjective, StudyUnit } from "../../src/domain/types.ts";

export const SOURCE_COMMIT = "e1ac219b22688230c330bed7dc3de1130b531b48";

export const CORE_TRACKS: SeedTrack[] = [MSCS_TRACK, PYTHON_TRACK, JAVASCRIPT_TRACK, SECPLUS_TRACK, LINUXPLUS_TRACK, CYSAPLUS_TRACK, PENTESTPLUS_TRACK, SECURITYX_TRACK, CMPCBS_TRACK];

const seed = (tracks: SeedTrack[], file: string) => tracks.map((track) => ({ track, sourceFile: `backend/supabase/seed/${file}` }));

/** Every Ascendra track, in the order its source files list them. Field and level come from src/content/study/paths.ts. */
export const SEED_TRACKS: Array<{ track: SeedTrack; sourceFile: string }> = [
  ...seed(AWS_TRACKS, "tracks/aws.ts"),
  ...seed(AZURE_TRACKS, "tracks/azure.ts"),
  ...seed(GCP_TRACKS, "tracks/gcp.ts"),
  ...seed(CORE_TRACKS, "data.ts"),
  ...seed(COMPTIA_TRACKS, "tracks/comptia.ts"),
  ...seed(PM_TRACKS, "tracks/pm.ts"),
  ...seed(NURSING_TRACKS, "tracks/nursing.ts"),
  ...seed(PT_TRACKS, "tracks/pt.ts"),
  ...seed(FITNESS_TRACKS, "tracks/fitness.ts"),
];

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function courseIdFor(track: SeedTrack): string {
  return (track.credential?.examCode ?? track.code).toLowerCase();
}

/** Stable JSON: two-space indent, trailing newline, keys in insertion order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

export interface BuiltCatalog {
  index: StudyCatalogIndex;
  courses: StudyCourse[];
  /** mission id -> objective ids it credits (for the mastery bridge) */
  missionLinks: Record<string, string[]>;
  /** engine id -> unit ids whose gate it would make playable */
  engineGates: Record<string, string[]>;
  /** lab exercise id -> objective ids it credits */
  labLinks: Record<string, string[]>;
  search: StudySearchIndex;
}

function normaliseText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function findOne<T>(items: T[], pick: (t: T) => string, fragment: string, what: string): T {
  const frag = normaliseText(fragment);
  const hits = items.filter((t) => normaliseText(pick(t)).includes(frag));
  if (hits.length !== 1) throw new Error(`${what}: fragment "${fragment}" matched ${hits.length} entries (need exactly 1)`);
  return hits[0];
}

function stripCoach(title: string): string {
  return title.replace(/\s+Coach$/, "");
}

export function buildCourse(track: SeedTrack, sourceFile: string): { course: StudyCourse; summary: Omit<StudyCourseSummary, "hash" | "file">; missionLinks: Record<string, string[]>; engineGates: Record<string, string[]>; labLinks: Record<string, string[]> } {
  const courseId = courseIdFor(track);
  const place = PLACEMENT[track.code];
  if (!place) throw new Error(`${track.code}: no field or level in src/content/study/paths.ts`);
  const bookkeepingUnits = new Set(BOOKKEEPING_UNITS.filter((b) => b.course === track.code).map((b) => b.unit));
  const links = STUDY_LINKS.filter((l) => l.course === track.code);
  const gates = UNIT_ENGINE_GATES.filter((g) => g.course === track.code);
  const missionLinks: Record<string, string[]> = {};
  const engineGates: Record<string, string[]> = {};
  const labLinks: Record<string, string[]> = {};
  const labs = STUDY_LAB_LINKS.filter((l) => l.course === track.code);

  // Resolve every curated entry up front so a stale fragment fails loudly.
  const allObjectives = track.units.flatMap((u, ui) => u.objectives.map((text, oi) => ({ text, ui, oi })));
  const linkByPos = new Map<string, (typeof links)[number]>();
  for (const l of links) {
    const hit = findOne(allObjectives, (o) => o.text, l.text, `${track.code} link to ${l.mission}`);
    const key = `${hit.ui}:${hit.oi}`;
    if (linkByPos.has(key)) throw new Error(`${track.code}: objective "${hit.text}" is linked twice`);
    linkByPos.set(key, l);
  }
  const labByPos = new Map<string, (typeof labs)[number]>();
  for (const l of labs) {
    const hit = findOne(allObjectives, (o) => o.text, l.text, `${track.code} lab link to ${l.lab}/${l.exerciseId ?? ""}`);
    const key = `${hit.ui}:${hit.oi}`;
    if (linkByPos.has(key) || labByPos.has(key)) throw new Error(`${track.code}: objective "${hit.text}" is linked twice`);
    labByPos.set(key, l);
  }
  const gateByUnit = new Map<number, string>();
  for (const g of gates) {
    const hit = findOne(
      track.units.map((u, ui) => ({ u, ui })).filter((x) => x.u.gate),
      (x) => x.u.gate ?? "",
      g.gateText,
      `${track.code} gate for ${g.engine}`,
    );
    gateByUnit.set(hit.ui, g.engine);
  }
  for (const b of bookkeepingUnits) findOne(track.units, (u) => u.title, b, `${track.code} bookkeeping unit`);

  const units: StudyUnit[] = track.units.map((u: SeedUnit, ui) => {
    const unitId = `${courseId}:${ui + 1}`;
    const bookkeeping = [...bookkeepingUnits].some((b) => normaliseText(u.title).includes(normaliseText(b)));
    const gateEngine = gateByUnit.get(ui);
    if (gateEngine) (engineGates[gateEngine] ??= []).push(unitId);
    const objectives: StudyObjective[] = u.objectives.map((text, oi) => {
      const id = `${unitId}:${oi + 1}`;
      const link = linkByPos.get(`${ui}:${oi}`);
      const lab = labByPos.get(`${ui}:${oi}`);
      const labPrompt = u.labs?.[oi] ?? undefined;
      const o: StudyObjective = {
        id,
        unitId,
        index: oi + 1,
        text,
        sourceHash: sha256(text).slice(0, 12),
        kind: bookkeeping ? "bookkeeping" : "objective",
        modality: link || lab ? "do-existing" : "read",
        modalitySource: link || lab ? "curated" : "default",
      };
      if (link) {
        o.link = { kind: "mission", missionId: link.mission, coverage: link.coverage, ...(link.note ? { note: link.note } : {}) };
        (missionLinks[link.mission] ??= []).push(id);
      } else if (lab) {
        o.link = { kind: "lab", labId: lab.lab, ...(lab.exerciseId ? { exerciseId: lab.exerciseId } : {}), coverage: lab.coverage, ...(lab.note ? { note: lab.note } : {}) };
        if (lab.exerciseId) (labLinks[lab.exerciseId] ??= []).push(id);
      }
      if (labPrompt) o.labPrompt = labPrompt;
      return o;
    });
    const unit: StudyUnit = { id: unitId, index: ui + 1, title: u.title, objectives };
    if (u.weight !== undefined) unit.weight = u.weight;
    if (u.rangeLabel) unit.rangeLabel = u.rangeLabel;
    if (u.gate) unit.gate = u.gate;
    if (gateEngine) unit.gateEngine = gateEngine;
    // Field order matters for stable JSON: rebuild with objectives last.
    const { objectives: objs, ...rest } = unit;
    return { ...rest, objectives: objs };
  });

  const all = units.flatMap((u) => u.objectives);
  const counts = {
    units: units.length,
    objectives: all.filter((o) => o.kind === "objective").length,
    bookkeeping: all.filter((o) => o.kind === "bookkeeping").length,
    linked: all.filter((o) => o.link?.kind === "mission" || o.link?.kind === "lab").length,
  };
  const modalities: Record<StudyModality, number> = { "do-existing": 0, "do-new": 0, read: 0, combo: 0, explain: 0 };
  for (const o of all) if (o.kind === "objective") modalities[o.modality] += 1;

  const cred = track.credential;
  const course: StudyCourse = {
    id: courseId,
    code: track.code,
    title: stripCoach(track.title),
    description: track.description,
    trackType: track.trackType,
    field: place.field,
    ...(track.requiresAcknowledgement ? { requiresAcknowledgement: true } : {}),
    units,
    provenance: {
      sourceRepo: "ascendra",
      sourceFile,
      sourceCommit: SOURCE_COMMIT,
      ...(track.sourceVerifiedAt ? { sourceVerifiedAt: track.sourceVerifiedAt } : {}),
      ...(cred?.officialObjectivesUrl ? { officialObjectivesUrl: cred.officialObjectivesUrl } : track.sourceUrl ? { officialObjectivesUrl: track.sourceUrl } : {}),
      ...(cred?.providerName ? { providerName: cred.providerName } : {}),
      ...(cred?.credentialName ? { credentialName: cred.credentialName } : {}),
      ...(cred?.examCode ? { examCode: cred.examCode } : {}),
      ...(cred?.status ? { credentialStatus: cred.status } : {}),
      ...(cred?.retirementDate ? { retirementDate: cred.retirementDate } : {}),
      note: "Objectives paraphrased from the publicly published exam guide or degree plan by the Ascendra project; unofficial; not affiliated with or endorsed by any vendor or credentialing body.",
    },
    counts,
  };
  const summary: Omit<StudyCourseSummary, "hash" | "file"> = {
    id: courseId,
    code: track.code,
    title: course.title,
    description: track.description,
    trackType: track.trackType,
    group: place.field,
    level: place.level,
    ...(track.requiresAcknowledgement ? { requiresAcknowledgement: true } : {}),
    ...(cred?.examCode ? { examCode: cred.examCode } : {}),
    ...(cred?.status ? { credentialStatus: cred.status } : {}),
    ...(cred?.retirementDate ? { retirementDate: cred.retirementDate } : {}),
    counts,
    modalities,
  };
  return { course, summary, missionLinks, engineGates, labLinks };
}

export function buildCatalog(): BuiltCatalog {
  const courses: StudyCourse[] = [];
  const summaries: StudyCourseSummary[] = [];
  const missionLinks: Record<string, string[]> = {};
  const engineGates: Record<string, string[]> = {};
  const labLinks: Record<string, string[]> = {};
  const seenIds = new Set<string>();
  for (const { track, sourceFile } of SEED_TRACKS) {
    const built = buildCourse(track, sourceFile);
    if (seenIds.has(built.course.id)) throw new Error(`duplicate course id ${built.course.id}`);
    seenIds.add(built.course.id);
    courses.push(built.course);
    summaries.push({ ...built.summary, file: `${built.course.id}.json`, hash: sha256(stableJson(built.course)).slice(0, 16) });
    for (const [m, ids] of Object.entries(built.missionLinks)) (missionLinks[m] ??= []).push(...ids);
    for (const [e, ids] of Object.entries(built.engineGates)) (engineGates[e] ??= []).push(...ids);
    for (const [e, ids] of Object.entries(built.labLinks)) (labLinks[e] ??= []).push(...ids);
  }
  for (const k of Object.keys(missionLinks)) missionLinks[k].sort();
  const sortedLinks = Object.fromEntries(Object.keys(missionLinks).sort().map((k) => [k, missionLinks[k]]));
  const sortedGates = Object.fromEntries(Object.keys(engineGates).sort().map((k) => [k, engineGates[k].sort()]));
  const sortedLabs = Object.fromEntries(Object.keys(labLinks).sort().map((k) => [k, labLinks[k].sort()]));
  // Every curated entry must have been consumed by some course.
  const known = new Set(SEED_TRACKS.map((s) => s.track.code));
  for (const l of STUDY_LINKS) if (!known.has(l.course)) throw new Error(`link for unknown course code ${l.course}`);
  for (const g of UNIT_ENGINE_GATES) if (!known.has(g.course)) throw new Error(`gate for unknown course code ${g.course}`);
  for (const l of STUDY_LAB_LINKS) if (!known.has(l.course)) throw new Error(`lab link for unknown course code ${l.course}`);
  for (const b of BOOKKEEPING_UNITS) if (!known.has(b.course)) throw new Error(`bookkeeping unit for unknown course code ${b.course}`);
  for (const code of Object.keys(PLACEMENT)) if (!known.has(code)) throw new Error(`placement for unknown course code ${code}`);
  for (const p of PATHS) for (const code of p.steps) {
    if (!known.has(code)) throw new Error(`path ${p.id} names unknown course code ${code}`);
    if (PLACEMENT[code].field !== p.field) throw new Error(`path ${p.id} is in ${p.field} but ${code} is placed in ${PLACEMENT[code].field}`);
  }
  return {
    index: { schemaVersion: 1, builtFrom: { sourceRepo: "ascendra", sourceCommit: SOURCE_COMMIT }, courses: summaries },
    courses,
    missionLinks: sortedLinks,
    engineGates: sortedGates,
    labLinks: sortedLabs,
    search: { schemaVersion: 1, objectives: courses.flatMap((c) => c.units.flatMap((u) => u.objectives.filter((o) => o.kind === "objective").map((o): [string, string] => [o.id, o.text]))) },
  };
}

/** The generated TypeScript module the app imports for the mastery bridge. */
export function missionLinksModule(built: BuiltCatalog): string {
  return [
    "// Generated by `npx tsx scripts/generate-study.mts build-catalog` from",
    "// src/content/study/links.ts and tools/ascendra-catalog. Do not edit by hand.",
    "",
    "/** OpsForge mission id -> Study objective ids that completing it credits. */",
    `export const MISSION_LINKS: Record<string, string[]> = ${JSON.stringify(built.missionLinks, null, 2)};`,
    "",
    "/** Planned engine id -> Study unit ids whose gate it would make playable. */",
    `export const ENGINE_GATES: Record<string, string[]> = ${JSON.stringify(built.engineGates, null, 2)};`,
    "",
    "/** Lab exercise id -> Study objective ids that passing it credits. */",
    `export const LAB_LINKS: Record<string, string[]> = ${JSON.stringify(built.labLinks, null, 2)};`,
    "",
  ].join("\n");
}
