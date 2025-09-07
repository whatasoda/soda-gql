# Tasks: Zero-runtime GraphQL Query Generation

**Input**: Design documents from `/specs/001-zero-runtime-gql-in-js/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `packages/core/`, `packages/plugin-babel/`, `packages/plugin-bun/`, `packages/cli/`
- Tests follow TDD structure: contract tests → integration tests → unit tests
- Paths shown below follow the monorepo structure from plan.md

## Phase 3.1: Setup

- [ ] T001 Create monorepo structure with packages/core, packages/plugin-babel, packages/plugin-bun, packages/cli
- [ ] T002 Initialize TypeScript project with Bun runtime and workspace configuration
- [ ] T003 [P] Configure ESLint, Prettier, and TypeScript paths in root tsconfig.json
- [ ] T004 [P] Install core dependencies: zod, neverthrow, typescript in packages/core/package.json
- [ ] T005 [P] Install plugin dependencies: @babel/core, @babel/types in packages/plugin-babel/package.json
- [ ] T006 [P] Setup Bun test configuration with TDD structure in bunfig.toml

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests

- [ ] T007 [P] Contract test for Plugin API transform hook in packages/plugin-babel/tests/contract/plugin-api.test.ts
- [ ] T008 [P] Contract test for Plugin API analysis hook in packages/plugin-babel/tests/contract/plugin-analysis.test.ts
- [ ] T009 [P] Contract test for Plugin API generation hook in packages/plugin-babel/tests/contract/plugin-generation.test.ts
- [ ] T010 [P] Contract test for Runtime API model function in packages/core/tests/contract/runtime-model.test.ts
- [ ] T011 [P] Contract test for Runtime API querySlice function in packages/core/tests/contract/runtime-query-slice.test.ts
- [ ] T012 [P] Contract test for Runtime API query composition in packages/core/tests/contract/runtime-query.test.ts
- [ ] T013 [P] Contract test for Runtime API registration system in packages/core/tests/contract/runtime-registration.test.ts

### Integration Tests (from Quickstart scenarios)

- [ ] T014 [P] Integration test for Remote Model definition and inference in packages/core/tests/integration/remote-model.test.ts
- [ ] T015 [P] Integration test for Query Slice composition in packages/core/tests/integration/query-slice.test.ts
- [ ] T016 [P] Integration test for Page Query generation in packages/core/tests/integration/page-query.test.ts
- [ ] T017 [P] Integration test for Transform function execution in packages/core/tests/integration/transform.test.ts
- [ ] T018 [P] Integration test for AST transformation pipeline in packages/plugin-babel/tests/integration/transform.test.ts
- [ ] T019 [P] Integration test for cross-module dependency resolution in packages/plugin-babel/tests/integration/dependencies.test.ts
- [ ] T020 [P] Integration test for document deduplication in packages/core/tests/integration/deduplication.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models (from data-model.md entities)

- [ ] T021 [P] RemoteModel type definitions in packages/core/src/models/remote-model.ts
- [ ] T022 [P] QuerySlice type definitions in packages/core/src/models/query-slice.ts
- [ ] T023 [P] MutationSlice type definitions in packages/core/src/models/mutation-slice.ts
- [ ] T024 [P] SubscriptionSlice type definitions in packages/core/src/models/subscription-slice.ts
- [ ] T025 [P] PageQuery type definitions in packages/core/src/models/page-query.ts
- [ ] T026 [P] FieldSelection type definitions in packages/core/src/models/field-selection.ts
- [ ] T027 [P] TransformFunction type definitions in packages/core/src/models/transform-function.ts
- [ ] T028 [P] GraphQLDocument type definitions in packages/core/src/models/graphql-document.ts
- [ ] T029 [P] Registration type definitions in packages/core/src/models/registration.ts
- [ ] T030 [P] Configuration schemas with Zod in packages/core/src/models/config.model.ts

### Core Services

- [ ] T031 [P] AST analyzer service in packages/plugin-babel/src/services/analyzer.service.ts
- [ ] T032 [P] Query generator service in packages/plugin-babel/src/services/generator.service.ts
- [ ] T033 [P] Document registry service in packages/core/src/services/registry.service.ts
- [ ] T034 [P] Transform executor service in packages/core/src/services/transform.service.ts
- [ ] T035 [P] Field selection builder in packages/core/src/services/selection.service.ts
- [ ] T036 [P] Dependency resolver service in packages/plugin-babel/src/services/dependency.service.ts

### Runtime API Implementation

- [ ] T037 Model function implementation in packages/core/src/lib/core/model.ts
- [ ] T038 QuerySlice function implementation in packages/core/src/lib/core/query-slice.ts
- [ ] T039 MutationSlice function implementation in packages/core/src/lib/core/mutation-slice.ts
- [ ] T040 Query composition function in packages/core/src/lib/core/query.ts
- [ ] T041 Mutation composition function in packages/core/src/lib/core/mutation.ts
- [ ] T042 Argument type helpers in packages/core/src/lib/core/arg-types.ts
- [ ] T043 Input parameter helpers in packages/core/src/lib/core/input-helpers.ts
- [ ] T044 Type inference utilities in packages/core/src/lib/core/infer.ts
- [ ] T045 Registration API implementation in packages/core/src/lib/core/registry.ts
- [ ] T046 Main gql API export in packages/core/src/lib/core/index.ts

### Plugin Implementation

- [ ] T047 Babel plugin factory in packages/plugin-babel/src/lib/plugin/index.ts
- [ ] T048 Transform hook implementation in packages/plugin-babel/src/lib/plugin/transform.ts
- [ ] T049 Analysis hook implementation in packages/plugin-babel/src/lib/plugin/analyze.ts
- [ ] T050 Generation hook implementation in packages/plugin-babel/src/lib/plugin/generate.ts
- [ ] T051 AST visitor for gql calls in packages/plugin-babel/src/lib/transforms/visitor.ts
- [ ] T052 Document extraction logic in packages/plugin-babel/src/lib/transforms/extractor.ts
- [ ] T053 Code replacement logic in packages/plugin-babel/src/lib/transforms/replacer.ts
- [ ] T054 Source map generation in packages/plugin-babel/src/lib/transforms/sourcemap.ts

### Bun Plugin Implementation

- [ ] T055 [P] Bun plugin factory in packages/plugin-bun/src/lib/plugin/index.ts
- [ ] T056 [P] Bun-specific optimizations in packages/plugin-bun/src/lib/plugin/optimize.ts
- [ ] T057 [P] Cache management for Bun in packages/plugin-bun/src/lib/plugin/cache.ts

### CLI Implementation

- [ ] T058 [P] Generate command in packages/cli/src/cli/commands/generate.ts
- [ ] T059 [P] Validate command in packages/cli/src/cli/commands/validate.ts
- [ ] T060 [P] Init command in packages/cli/src/cli/commands/init.ts
- [ ] T061 [P] CLI entry point in packages/cli/src/cli/index.ts
- [ ] T062 [P] Schema loader utility in packages/cli/src/cli/utils/schema-loader.ts
- [ ] T063 [P] Type generator from schema in packages/cli/src/cli/utils/type-generator.ts

## Phase 3.4: Integration

### Build System Integration

- [ ] T064 Bundle configuration for packages/core in packages/core/build.config.ts
- [ ] T065 Bundle configuration for packages/plugin-babel in packages/plugin-babel/build.config.ts
- [ ] T066 Bundle configuration for packages/plugin-bun in packages/plugin-bun/build.config.ts
- [ ] T067 Bundle configuration for packages/cli in packages/cli/build.config.ts
- [ ] T068 Performance monitoring hooks in packages/plugin-babel/src/lib/plugin/performance.ts
- [ ] T069 Error reporting system in packages/plugin-babel/src/lib/plugin/errors.ts
- [ ] T070 Incremental compilation support in packages/plugin-babel/src/lib/plugin/incremental.ts

### Generated System Structure

- [ ] T071 System generator for graphql-system/index.ts template
- [ ] T072 Type definitions generator for graphql-system/types.ts
- [ ] T073 Input types generator for graphql-system/inputs.ts
- [ ] T074 Scalar types generator for graphql-system/scalars.ts
- [ ] T075 Enum types generator for graphql-system/enums.ts

## Phase 3.5: Polish

### Unit Tests

- [ ] T076 [P] Unit tests for RemoteModel validation in packages/core/tests/unit/models/remote-model.test.ts
- [ ] T077 [P] Unit tests for QuerySlice merging in packages/core/tests/unit/models/query-slice.test.ts
- [ ] T078 [P] Unit tests for Transform functions in packages/core/tests/unit/services/transform.test.ts
- [ ] T079 [P] Unit tests for AST analysis in packages/plugin-babel/tests/unit/services/analyzer.test.ts
- [ ] T080 [P] Unit tests for Document generation in packages/plugin-babel/tests/unit/services/generator.test.ts
- [ ] T081 [P] Unit tests for Registry operations in packages/core/tests/unit/services/registry.test.ts

### Performance Tests

- [ ] T082 Performance test for < 100ms per file transformation in packages/plugin-babel/tests/performance/transform.bench.ts
- [ ] T083 Performance test for < 500ms incremental builds in packages/plugin-babel/tests/performance/incremental.bench.ts
- [ ] T084 Performance test for < 1ms transform functions in packages/core/tests/performance/transform.bench.ts
- [ ] T085 Memory usage test for < 50MB analysis phase in packages/plugin-babel/tests/performance/memory.bench.ts

### Documentation and Examples

- [ ] T086 [P] Create basic example in examples/basic/ with user/post queries
- [ ] T087 [P] Create advanced example in examples/advanced/ with parameterized models
- [ ] T088 [P] Create feature-sliced example in examples/feature-sliced/
- [ ] T089 [P] API documentation in packages/core/README.md
- [ ] T090 [P] Plugin documentation in packages/plugin-babel/README.md
- [ ] T091 [P] CLI documentation in packages/cli/README.md
- [ ] T092 [P] Migration guide from graphql-codegen in docs/migration.md

### Final Validation

- [ ] T093 Run quickstart.md scenarios end-to-end
- [ ] T094 Validate all contract tests pass
- [ ] T095 Check TypeScript strict mode compliance
- [ ] T096 Verify zero runtime overhead with bundle analysis
- [ ] T097 Ensure < 32 slice warning system works
- [ ] T098 Test error recovery and hot reload

## Dependencies

- Setup (T001-T006) blocks all other tasks
- Contract tests (T007-T013) before Runtime API implementation (T037-T046)
- Integration tests (T014-T020) before Core Services (T031-T036)
- Data Models (T021-T030) can run parallel with tests
- Core Services before Plugin implementation (T047-T054)
- Plugin implementation before CLI (T058-T063)
- All implementation before Integration (T064-T075)
- Integration before Polish (T076-T098)

## Parallel Execution Examples

### Initial Test Wave (after setup)

```bash
# Launch T007-T020 together (all test files are independent):
Task: "Contract test for Plugin API transform hook"
Task: "Contract test for Runtime API model function"
Task: "Integration test for Remote Model definition"
Task: "Integration test for Query Slice composition"
# ... (14 parallel test tasks)
```

### Model Definition Wave

```bash
# Launch T021-T030 together (all different model files):
Task: "RemoteModel type definitions in packages/core/src/models/remote-model.ts"
Task: "QuerySlice type definitions in packages/core/src/models/query-slice.ts"
Task: "PageQuery type definitions in packages/core/src/models/page-query.ts"
# ... (10 parallel model tasks)
```

### Service Implementation Wave

```bash
# Launch T031-T036 together (all different service files):
Task: "AST analyzer service in packages/plugin-babel/src/services/analyzer.service.ts"
Task: "Query generator service in packages/plugin-babel/src/services/generator.service.ts"
Task: "Document registry service in packages/core/src/services/registry.service.ts"
# ... (6 parallel service tasks)
```

## Notes

- **TDD Enforcement**: Tests MUST fail before implementation
- **[P] Safety**: Parallel tasks work on different files
- **Commit Frequency**: After each task completion
- **Performance Gates**: Must meet targets before proceeding
- **Type Safety**: Full inference chain must be validated

## Task Generation Rules

_Applied during main() execution_

1. **From Contracts**:
   - plugin-api.ts → T007-T009 (transform, analysis, generation tests)
   - runtime-api.ts → T010-T013 (model, slice, query, registration tests)
2. **From Data Model**:
   - Each entity (RemoteModel, QuerySlice, etc.) → T021-T029
   - Configuration schemas → T030
3. **From Quickstart Scenarios**:

   - Remote Model usage → T014
   - Query Slice usage → T015
   - Page Query usage → T016
   - Transform execution → T017

4. **Ordering**:
   - Setup → Tests → Models/Services (parallel) → API Implementation → Plugin → CLI → Integration → Polish
   - Dependencies strictly enforced for TDD

## Validation Checklist

_GATE: Checked by main() before returning_

- [x] All contracts have corresponding tests (T007-T013)
- [x] All entities have model tasks (T021-T029)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Performance targets defined (T082-T085)
- [x] Quickstart scenarios covered (T014-T020, T093)
