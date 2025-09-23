# Tasks: Zero-runtime GraphQL Query Generation System (Original)

**Input**: Design documents from `/specs/001-zero-runtime-gql-in-js/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup
- [x] T001 Prepare integration fixture project under `tests/fixtures/runtime-app/` (schema SDL, entry modules, Babel config skeleton) to exercise runtime→zero-runtime workflows.

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE PHASE 3.3
- [x] T002 [P] Write failing contract tests for `soda-gql codegen` CLI scenarios (missing schema, invalid schema, success snapshot) in `tests/contract/codegen/codegen_cli.test.ts`.
- [x] T003 [P] Write failing contract tests for `soda-gql builder` CLI (cycle detection, duplicate document, successful artifact) in `tests/contract/builder/builder_cli.test.ts`.
- [x] T004 [P] Write failing contract tests for `@soda-gql/plugin-babel` (missing artifact, missing document, zero-runtime transform snapshot) in `tests/contract/plugin-babel/plugin_babel.test.ts`.
- [x] T005 [P] Author failing integration test validating runtime builder flow (`codegen` → `builder --mode runtime`) in `tests/integration/runtime_builder_flow.test.ts` using the fixture project.
- [x] T006 [P] Author failing integration test covering zero-runtime Babel transform using builder artifact in `tests/integration/zero_runtime_transform.test.ts`.
- [x] T007 [P] Create failing unit tests for canonical identifier + document registry utilities in `tests/unit/builder/document_registry.test.ts`.
- [x] T008 [P] Create failing unit tests for `createGql` helper bundle wiring (model/querySlice/query factories) in `tests/unit/core/createGql.test.ts`.

## Phase 3.3: Core Implementation (only after Phase 3.2 tests are RED)
- [x] T009 Implement canonical identifier helpers and document registry in `packages/builder/src/registry.ts` (exported via `packages/builder/src/index.ts`) to satisfy T007.
- [x] T010 Implement `createGql` factory and helper exports in `packages/core/src/index.ts` to satisfy T008 and quickstart usage.
- [x] T011 Implement builder pipeline (discovery, evaluation, artifact emission) plus CLI handler in `packages/builder/src/index.ts` backed by registry utilities to satisfy T003/T005.
- [x] T012 Implement schema ingestion + `graphql-system` bundle emission for `soda-gql codegen` in `packages/codegen/src/index.ts`, including neverthrow/zod validation, to satisfy T002/T005.
- [x] T013 Implement `@soda-gql/plugin-babel` transform logic in `packages/plugin-babel/src/index.ts`, consuming builder artifacts for zero-runtime replacement to satisfy T004/T006.

## Phase 3.4: Integration & Tooling
- [ ] T014 Wire CLI entry points for codegen and builder (`package.json` bin fields in `packages/codegen`/`packages/builder` and root `package.json` scripts) and add test helper `tests/helpers/runCli.ts` used by contract/integration tests.
- [ ] T015 Implement shared integration helper `tests/integration/helpers/runtime_fixture.ts` to orchestrate quickstart steps (codegen → builder → plugin) for T005/T006.
- [ ] T016 Add fixture-specific Babel/TS configs and ensure generated `graphql-system` module is resolved inside `tests/fixtures/runtime-app/` to support integration tests.

## Phase 3.5: Polish & Validation
- [ ] T017 [P] Update `docs/runtime-to-zero-runtime.md` and `specs/001-zero-runtime-gql-in-js/quickstart.md` with final CLI commands and troubleshooting tips.
- [ ] T018 [P] Document new CLI commands and Babel plugin usage in `README.md` and package-level READMEs.
- [ ] T019 [P] Implement performance guard/warning reporting in builder (warn ≥16 slices, error >32) and cover via additional assertions in `tests/contract/builder/builder_cli.test.ts`.
- [ ] T020 Run full verification (`bun test`, `bun run soda-gql codegen`, `bun run soda-gql builder`, zero-runtime transform on fixture) and capture results in `docs/validation/runtime-to-zero-runtime.md`.

## Dependencies
- T002–T008 must be completed (and failing) before starting T009–T013.
- T009 precedes T011; T012 precedes T005 integration pass; T013 precedes T006.
- T014 depends on T002–T013 for context; T015 depends on T005/T006 scaffolding; T016 depends on T001.
- Polish tasks (T017–T020) run only after all prior tasks are GREEN; T020 depends on T017–T019.

## Parallel Execution Example
```
# Run initial RED test authoring in parallel (separate files, no shared deps)
Task: "T002 [P] Write failing contract tests for soda-gql codegen CLI..."
Task: "T003 [P] Write failing contract tests for soda-gql builder CLI..."
Task: "T004 [P] Write failing contract tests for @soda-gql/plugin-babel..."
Task: "T005 [P] Author failing integration test validating runtime builder flow..."
Task: "T006 [P] Author failing integration test covering zero-runtime Babel transform..."
Task: "T007 [P] Create failing unit tests for canonical identifier + document registry..."
Task: "T008 [P] Create failing unit tests for createGql helper bundle wiring..."
```

## Notes
- All [P] tasks touch distinct files and can be delegated concurrently.
- Maintain strict TDD: ensure each test added in Phase 3.2 fails before implementing corresponding functionality.
- Use `bun test <path>` for targeted Red/Green cycles; document results in commit messages aligned with t_wada methodology.
