# Tasks: Zero-runtime GraphQL Query Generation System — Builder Rework

**Input**: Design documents from `/specs/001-zero-runtime-gql-in-js/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup
- [ ] T001 Align builder dependencies with SWC-based pipeline by adding `@swc/core` and `@swc/types` to `packages/builder/package.json` and updating `packages/builder/tsconfig.json` for new `src/ast/` modules.

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE PHASE 3.3
- [ ] T002 [P] Add failing unit tests exercising SWC module analysis (top-level enforcement, identifier extraction) in `tests/unit/builder/module_analysis.test.ts`.
- [ ] T003 [P] Add failing unit tests covering dependency graph resolution (re-exports, canonical IDs, cycle diagnostics) in `tests/unit/builder/dependency_resolver.test.ts`.
- [ ] T004 [P] Add failing unit tests for cache invalidation semantics (hash reuse vs change) in `tests/unit/builder/cache_manager.test.ts`.
- [ ] T005 Extend `tests/contract/builder/builder_cli.test.ts` with failing scenarios for human-readable diagnostics, cache hit logging, and slice-count warnings.
- [ ] T006 Add failing integration test `tests/integration/builder_cache_flow.test.ts` validating runtime builder reruns with cached modules and real document emission.

## Phase 3.3: Core Implementation (ONLY after Phase 3.2 tests are RED)
- [ ] T007 Implement SWC parser wrapper and AST helper exports in `packages/builder/src/ast/parser.ts` (export via `packages/builder/src/index.ts`) to satisfy T002.
- [ ] T008 Replace `packages/builder/src/discover.ts` with SWC-driven `analyzeModule` capturing top-level gql definitions, canonical IDs, and AST spans to satisfy T002.
- [ ] T009 Implement dependency resolver + canonical ID graph builder in `packages/builder/src/dependency-graph.ts`, including re-export resolution and enhanced cycle errors, to satisfy T003.
- [ ] T010 Integrate analyzer + resolver into builder pipeline by rewriting `packages/builder/src/runner.ts` and `packages/builder/src/artifact.ts` to evaluate refs and emit real documents, satisfying T005/T006.
- [ ] T011 Implement cache manager in `packages/builder/src/cache.ts` (file hash persistence under `.cache/soda-gql/builder/`) and wire into runner execution to satisfy T004/T006.
- [ ] T012 Update CLI handling (`packages/builder/src/cli.ts`, `packages/builder/src/options.ts`) to support watch mode reuse, cache logging, and zod-validated options per Stage F.
- [ ] T013 Extend artifact writers (`packages/builder/src/writer.ts` and new `packages/builder/src/reporters/human.ts`) with human-readable diagnostics, duration metrics, and slice-count warnings to satisfy T005.

## Phase 3.4: Integration & Tooling
- [ ] T014 Wire builder and codegen binaries in `packages/builder/package.json`, `packages/codegen/package.json`, and root `package.json` scripts; author reusable CLI helper in `tests/helpers/runCli.ts`.
- [ ] T015 Implement shared integration helper `tests/integration/helpers/runtime_fixture.ts` orchestrating codegen → builder → plugin flow with cache resets, and refactor integration tests to use it.
- [ ] T016 Finalise fixture configs (`tests/fixtures/runtime-app/tsconfig.json`, Babel settings, module aliases) so generated `@/graphql-system` resolves consistently during cached runs.

## Phase 3.5: Polish & Validation
- [ ] T017 [P] Update `docs/runtime-to-zero-runtime.md` and `specs/001-zero-runtime-gql-in-js/quickstart.md` with SWC analyzer workflow, cache directory details, and watch guidance.
- [ ] T018 [P] Refresh developer docs (`README.md`, `packages/builder/README.md`) to describe new CLI flags, diagnostics formats, and cache behaviour.
- [ ] T019 Extend `tests/contract/builder/builder_cli.test.ts` and builder runtime to enforce slice-count warning/error thresholds with metrics recorded in artifact report.
- [ ] T020 Run full verification (`bun test`, targeted CLI commands, zero-runtime transform) and capture output in `docs/validation/runtime-to-zero-runtime.md`.

## Dependencies
- T002–T006 must fail before starting T007–T013.
- T007 feeds T008; T008 and T009 must complete before T010.
- T010 depends on T011 for cache wiring; T011 depends on T004.
- T012 and T013 require T010 completion.
- T014–T016 depend on core pipeline (T007–T013) and integration tests (T005–T006).
- T017–T020 run after all implementation and integration tasks are GREEN; T019 precedes T020.

## Parallel Execution Example
```
# Parallel RED phase across disjoint test files
Task: "T002 [P] Add failing unit tests exercising SWC module analysis..."
Task: "T003 [P] Add failing unit tests covering dependency graph resolution..."
Task: "T004 [P] Add failing unit tests for cache invalidation semantics..."
Task: "T006 Add failing integration test tests/integration/builder_cache_flow.test.ts..."
```

## Notes
- Maintain strict TDD: ensure each new test fails before implementing corresponding functionality.
- Cache artifacts should live under `.cache/soda-gql/builder/` per plan.md; avoid polluting fixture directories.
- Use Bun-native APIs (`Bun.file`, `Bun.hash`, `Bun.watch`) when implementing runtime and caching logic.
