# Ascendra catalog snapshot

The TypeScript files here are copied from the Ascendra repository
(`paukennick/Ascendra`, private) and are the only input to OpsForge's Study
area. They are data, not code that runs in the app: `scripts/generate-study.mts
build-catalog` turns them into the JSON files under `public/study/`.

| Item | Value |
|---|---|
| Source commit | `e1ac219b22688230c330bed7dc3de1130b531b48` (2026-10-09) |
| `data.ts` | `backend/supabase/seed/data.ts`, byte-identical |
| `tracks/*.ts` | `backend/supabase/seed/tracks/*.ts` (aws, azure, gcp, comptia, pm, nursing, pt, pt-dpt, pt-abpts, fitness); one change in each: imports name `../data.ts` and the sibling `./pt-dpt.ts` / `./pt-abpts.ts` with their extension so Node's module resolution accepts them |
| Courses used | all 90 of Ascendra's tracks |

What the files contain: course titles and descriptions, unit titles, exam
weights, one-sentence mastery gates, objective lines, provenance (source URL,
verification date, exam code and status) and a few lab prompts. They contain no
lessons, questions or scenarios; Ascendra generates those at request time and
OpsForge generates its own (see `docs/STUDY_GENERATION.md`).

Ascendra's own provenance note applies: objectives are paraphrased from each
vendor's published exam guide, never copied, and the catalog is not affiliated
with or endorsed by any vendor or credentialing body.

To refresh: copy the files again from a newer Ascendra commit, re-apply the
import-extension change, update the commit above, run
`npx tsx scripts/generate-study.mts build-catalog`, then look at the diff of
`public/study/` and at the link table in `src/content/study/links.ts`, whose
entries match objectives by text and fail the build when a text has changed.
