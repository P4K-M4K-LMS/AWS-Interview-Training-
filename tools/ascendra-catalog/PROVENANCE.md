# Ascendra catalog snapshot

The two TypeScript files here are copied from the Ascendra repository
(`paukennick/Ascendra`, private) and are the only input to OpsForge's Study
area. They are data, not code that runs in the app: `scripts/generate-study.mts
build-catalog` turns them into the JSON files under `public/study/`.

| Item | Value |
|---|---|
| Source commit | `e1ac219b22688230c330bed7dc3de1130b531b48` (2026-10-09) |
| `data.ts` | `backend/supabase/seed/data.ts`, byte-identical |
| `tracks/aws.ts` | `backend/supabase/seed/tracks/aws.ts`, one change: the type import names `../data.ts` with its extension so Node's module resolution accepts it |
| Courses used | the 9 tracks in `data.ts` and the 11 in `tracks/aws.ts` (20 of Ascendra's 90) |

What the files contain: course titles and descriptions, unit titles, exam
weights, one-sentence mastery gates, objective lines, provenance (source URL,
verification date, exam code and status) and a few lab prompts. They contain no
lessons, questions or scenarios; Ascendra generates those at request time and
OpsForge generates its own (see `docs/STUDY_GENERATION.md`).

Ascendra's own provenance note applies: objectives are paraphrased from each
vendor's published exam guide, never copied, and the catalog is not affiliated
with or endorsed by any vendor or credentialing body.

To refresh: copy the two files again from a newer Ascendra commit, re-apply the
one-line import change, update the commit above, run
`npx tsx scripts/generate-study.mts build-catalog`, then look at the diff of
`public/study/` and at the link table in `src/content/study/links.ts`, whose
entries match objectives by text and fail the build when a text has changed.
