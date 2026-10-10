# Study lesson generation

Study lessons are machine-written once, on the owner's machine, and shipped as static JSON. Nothing in CI or in the browser calls a model to produce content. This page is the procedure and the quality gate.

## What gets generated

For every learnable objective in a course (`public/study/<course>.json`, bookkeeping lines excluded), two structured calls:

1. **Lesson**: `plain` (a beginner paragraph in the style of the mission primers, no code), `guessPrompt`, `teach` (every named term defined, why it works, one worked example, one common mistake), `explainPrompt`, `modelAnswer`, `rubricPoints`, and a `suggested` modality with a rationale.
2. **Bank**: one "fade" question (mostly worked, one missing step) and three "solo" questions, four choices each. Choices are shuffled with a seed derived from the question id, so the correct answer is not always first; the player shuffles again at display time.

For every unit, one call for a multi-part **scenario** (2–4 numbered sub-tasks) with a model answer per sub-task, which is the grader's key.

The model sees the course description, the unit title, weight and mastery gate, and the unit's other objectives, so it can stay in scope. The rules forbid copying vendor text and forbid any claim of certification equivalence; the validator (`src/services/study/validate.ts`) rejects such phrases and every structural mistake (wrong counts, repeated choices, index out of range, stale source hash). Prompts live in `scripts/study/prompts.mts`; `PROMPT_VERSION` there must be bumped when wording changes, which marks every existing lesson stale.

## Running it

```bash
# 1. catalog is current
npx tsx scripts/generate-study.mts build-catalog

# 2. see what would be generated and roughly how much prompt text that is (no key needed)
npx tsx scripts/generate-study.mts generate --course saa-c03 --dry-run

# 3. five lessons first; read them in public/study/saa-c03.lessons.json
ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/generate-study.mts generate --course saa-c03 --limit 5

# 4. the whole course (lessons, then scenarios); resumable, re-run after failures
ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/generate-study.mts generate --course saa-c03

# 5. check, then look at the modality suggestions
npx tsx scripts/generate-study.mts validate --course saa-c03
npx tsx scripts/generate-study.mts review --course saa-c03
```

Flags: `--unit <n>` (one unit), `--limit <n>` (first n missing lessons, no scenarios), `--force` (regenerate everything in scope), `--concurrency <n>` (default 4), `--model <id>` (default `STUDY_MODEL`, then `COACH_MODEL`, then the proxy's default), `--out <file>`. Failures are written to `scripts/study/.failures.json` (gitignored); a re-run retries only what is missing. Rate-limit and overload responses are retried with backoff.

Model choice is the owner's. The script never prints prices; the dry run prints prompt character counts and, with a key, the measured input tokens of one lesson call.

## Quality gate before generating the other courses

Done by the owner on SAA-C03, the first course, and recorded here with the date and prompt version:

1. Sample 20 objectives across all four domains.
2. Every named term is defined; the teaching stays inside the objective.
3. Each of the four questions is answerable from the teach text alone; the marked choice is correct; the other three are real misconceptions, not filler.
4. The `plain` paragraph has no undefined jargon and would make sense to someone new to the field.
5. The model answer covers every rubric point.
6. The scenario's numbered sub-tasks match its labels and answers.
7. Nothing reads like copied vendor documentation or exam text.

Fix problems by changing the prompt (bump `PROMPT_VERSION`, re-run with `--force --course saa-c03`), never by editing the JSON by hand; hand edits are lost on the next regeneration.

Promote suggestions you agree with from `review` into `src/content/study/links.ts` (do-existing links) and re-run `build-catalog`; the `suggested` field stays in the lessons file for the record.

| Date | Course | Prompt version | Result |
|---|---|---|---|
| (not yet run) | saa-c03 | 1 | |

## Importing the lessons Ascendra already wrote

Ascendra wrote each lesson the first time a learner opened an objective and cached it in its own database (Supabase, table `lesson_content`; scenarios in `pbq_scenarios`). Those lessons can be brought in without a key. They are thinner than generated ones: no plain paragraph, no explain-it-back, one fade and one solo question, written from the objective title alone. The player labels them as imported, and they take an objective to Guided at most. A generated lesson for the same objective replaces the imported one, so both can be used: import now, generate later.

1. In the Supabase project, open **SQL Editor** (restore the project first if it is paused) and run:

   ```sql
   select distinct on (t.code, u.sort_order, o.sort_order)
     t.code as course_code, u.sort_order as unit_order, u.title as unit_title,
     o.sort_order as objective_order, o.title as objective,
     l.guess_prompt, l.teach,
     l.fade_problem, l.fade_choices, l.fade_correct_index, l.fade_why,
     l.solo_check, l.solo_choices, l.solo_correct_index, l.solo_why,
     l.model, l.generated_at
   from lesson_content l
   join objectives o on o.id = l.objective_id
   join course_units u on u.id = o.unit_id
   join subject_tracks t on t.id = u.track_id
   order by t.code, u.sort_order, o.sort_order, l.generated_at desc;
   ```

   It reads lesson text only: no accounts, emails or progress.

2. Download the result as JSON (or CSV) into `tools/ascendra-export/` in this repo. That folder is gitignored: the raw export is never committed.

3. Convert it:

   ```bash
   npx tsx scripts/generate-study.mts import --file tools/ascendra-export/<file>.json
   npx tsx scripts/generate-study.mts validate
   ```

   The command writes one `public/study/<course>.imported.json` per catalog course it found rows for and prints how many objectives each covers, the rows for courses outside the catalog, the rows whose objective text matched nothing, and any rows left out by validation. `--course saa-c03` limits it to one course. Re-running replaces the imported files.

4. Commit the `*.imported.json` files. `build-catalog` keeps them.

## Cost and the usage log

Every `generate` run prints what it was billed for (calls, input and output tokens, and a cost at list price for models whose price is in `PRICES` in `scripts/study/generate.mts`) and appends one JSON line to `scripts/study/.usage.jsonl` (gitignored). The Console's billing page is the record; the log is for planning the next batch. Measured on claude-opus-5-5 in October 2026: about $0.10 per objective, lesson and question bank together, plus about $0.15 per unit scenario.

Health courses (nursing, physical therapy, fitness) get extra prompt rules: exam preparation only, no individual medical advice, no invented doses or values, regional differences named, fictional patients only.

## Honesty

Every lesson footer in the app names the model and date from the file's metadata. The material is unofficial, not reviewed by any vendor, and finishing a course is not a credential. Objective status still comes only from answered questions and completed missions, never from reading.
