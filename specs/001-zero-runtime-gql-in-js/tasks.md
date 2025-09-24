# Tasks: Zero-runtime GraphQL Query Generation System — Builder Rework

**Input**: Design documents from `/specs/001-zero-runtime-gql-in-js/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup
- [x] T001 Align builder dependencies with SWC-based pipeline by adding `@swc/core` and `@swc/types` to `packages/builder/package.json` and updating `packages/builder/tsconfig.json` for new AST modules. *(Done — packages now include SWC deps and build succeeds.)*

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE PHASE 3.3
- [x] T002 [P] Add failing unit tests exercising SWC module analysis (top-level enforcement, identifier extraction) in `tests/unit/builder/module_analysis.test.ts`. *(SWC parity tests in place and passing.)*
- [x] T003 [P] Add failing unit tests covering dependency graph resolution (re-exports, canonical IDs, cycle diagnostics) in `tests/unit/builder/dependency_resolver.test.ts`. *(Extended suite verifies namespace and barrel behaviour.)*
- [x] T004 [P] Add failing unit tests for cache invalidation semantics (hash reuse vs change) in `tests/unit/builder/cache_manager.test.ts`. *(Cache tests updated for new analysis payloads.)*
- [x] T005 Extend `tests/contract/builder/builder_cli.test.ts` with failing scenarios for human-readable diagnostics, cache hit logging, and slice-count warnings. *(Human output & warnings asserted.)*
- [x] T006 Add failing integration test `tests/integration/builder_cache_flow.test.ts` validating runtime builder reruns with cached modules and real document emission. *(Integration flows exercising runtime module are passing.)*

## Phase 3.3: Core Implementation (ONLY after Phase 3.2 tests are RED)
- [x] T007 Implement SWC parser wrapper and AST helper exports in the analyzer to satisfy T002. *(SWC-based `analyze-module-swc` now mirrors TS analyser with fallback support.)*
- [x] T008 Replace `discover`-based regex parsing with SWC-driven module analysis capturing canonical IDs. *(Loader now consumes analyzer output; legacy discover logic only used for CLI scans and slated for removal.)*
- [x] T009 Implement dependency resolver + canonical ID graph builder in `packages/builder/src/dependency-graph.ts`, including re-export resolution and enhanced cycle errors, to satisfy T003. *(Graph nodes now hold dependency edges and symbol maps.)*
- [x] T010 Integrate analyzer + resolver into builder pipeline by rewriting `packages/builder/src/runner.ts` and `packages/builder/src/artifact.ts` to evaluate refs and emit real documents, satisfying T005/T006. *(Builder executes via generated runtime module.)*
- [x] T011 Implement cache manager in `packages/builder/src/cache.ts` and wire into runner execution to satisfy T004/T006. *(Cache hits/misses reported in artifact.)*
- [ ] T012 Update CLI handling (`packages/builder/src/cli.ts`, `packages/builder/src/options.ts`) to support watch mode reuse, cache logging, and zod-validated options per Stage F. *(Pending — current CLI lacks watch-mode wiring and stronger validation.)*
- [ ] T013 Extend artifact writers (`packages/builder/src/writer.ts` and new `packages/builder/src/reporters/human.ts`) with human-readable diagnostics, duration metrics, and slice-count warnings to satisfy T005. *(Basic human output exists via CLI, but dedicated reporter + metrics refactor still outstanding.)*

## Phase 3.4: Integration & Tooling
- [ ] T014 Wire builder and codegen binaries in `packages/builder/package.json`, `packages/codegen/package.json`, and root `package.json` scripts; author reusable CLI helper in `tests/helpers/runCli.ts`.
- [ ] T015 Implement shared integration helper `tests/integration/helpers/runtime_fixture.ts` orchestrating codegen → builder → plugin flow with cache resets, and refactor integration tests to use it.
- [ ] T016 Finalise fixture configs (`tests/fixtures/runtime-app/tsconfig.json`, Babel settings, module aliases) so generated `@/graphql-system` resolves consistently during cached runs.

## Phase 3.5: Polish & Validation
- [ ] T017 [P] Update `docs/runtime-to-zero-runtime.md` and `specs/001-zero-runtime-gql-in-js/quickstart.md` with SWC analyzer workflow, cache directory details, and watch guidance.
- [ ] T018 [P] Refresh developer docs (`README.md`, `packages/builder/README.md`) to describe new CLI flags, diagnostics formats, and cache behaviour.
- [ ] T019 Extend `tests/contract/builder/builder_cli.test.ts` and builder runtime to enforce slice-count warning/error thresholds with metrics recorded in artifact report.
- [ ] T020 Run full verification (`bun test`, targeted CLI commands, zero-runtime transform) and capture output in `docs/validation/runtime-to-zero-runtime.md`.

## Newly Identified Follow-ups
- **T021** Ensure generated runtime modules are emitted as executable JavaScript (strip TypeScript-only syntax or transpile prior to import) so downstream consumers do not rely on Bun's TS loader.
- **T022** Refine CLI option handling to surface the new runtime-module workflow (e.g., `--runtime-out`, watch-mode) and document the placeholder behaviour expected by plugins.

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
