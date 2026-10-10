# Project Configuration

Fill these values before using this workspace on a specific project. These
settings correspond to `.ai/rules/universal-engineering-ruleset.json`.

## Required Project Values

- `project_name`: `AWS-Interview-Training-`
- `repository_type`: `web_app`
- `primary_language_or_stack`: `TypeScript, React, Vite; Go runner compiled to WebAssembly (go/runner); optional Node servers (server/)`
- `package_manager`: `npm`
- `build_command`: `npm run build`
- `test_command`: `npm run test` (unit, vitest); `npm run test:e2e` (Playwright)
- `lint_command`: `npm run lint`
- `typecheck_command`: `npm run typecheck`
- `changelog_location`: `CHANGELOG.md`
- `documentation_locations`: `README.md, docs/ARCHITECTURE.md, STATUS.md, docs/USER_GUIDE.md, docs/SETUP.md, docs/ROADMAP.md, docs/CURRICULUM.md`
- `branching_or_pr_standard`: `feature branch off main, squash-merged pull request`
- `comment_style`: `match the surrounding file`
- `requirement_id_prefix`: `REQ`

## Default Safety Flags

- `allow_broad_refactor`: `false`
- `allow_dependency_changes`: `false`
- `allow_schema_changes`: `false`
- `allow_destructive_data_changes`: `false`
- `require_user_confirmation_for_destructive_actions`: `true`

## Per-Task Requirement Template

- `id`: `REQ-###`
- `category`: `<CATEGORY>`
- `title`: `<SHORT_TITLE>`
- `description`: `<CLEAR_DESCRIPTION_OF_THE_CHANGE>`
- `priority`: `<critical | high | medium | low>`
- `minimum_access_scope`: `<specific file/module/component/table/config/test/doc>`
- `do_not_access`: `<specific excluded area>`
- `acceptance_criteria`: `<observable completion criteria>`
- `validation_required`: `<build | test | lint | typecheck | manual_verification | data_validation | security_review>`
- `documentation_required`: `<changelog | readme | architecture | api | data_model | deployment | none>`
- `risk_notes`: `<known risk, dependency, assumption, or follow-up>`
