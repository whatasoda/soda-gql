# Tasks: Zero-runtime GraphQL Query Generation System

**Input**: Design documents from `/specs/001-zero-runtime-gql-in-js/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **CRITICAL**: Never import from `/specs/` - copy types to packages

## Path Conventions
- Monorepo structure with packages/
- Direct TypeScript imports between packages (no build step initially)
- No file extensions in imports

## Phase A: Runtime Implementation (Foundation)

### A.1: Project Setup
- [ ] T001 Initialize monorepo with Bun workspaces in package.json
- [ ] T002 Create base TypeScript configuration files (tsconfig.json, tsconfig.base.json)
- [ ] T003 [P] Create package directories: packages/core, packages/codegen, packages/builder, packages/plugin-babel, packages/cli
- [ ] T004 [P] Initialize package.json for each package with workspace protocol dependencies
- [ ] T005 Configure tsconfig.json in each package extending ../../tsconfig.base.json
- [ ] T006 [P] Install core dependencies: bun add neverthrow zod@4
- [ ] T007 [P] Setup biome for linting and formatting with biome.json
- [ ] T008 Create .gitignore with node_modules, dist, coverage patterns

### A.2: Core Package - Type Definitions (TDD - Tests First)
**CRITICAL: Write tests first, they MUST fail before implementation**

- [ ] T009 [P] Write failing test for RemoteModel type in packages/core/src/__tests__/types/remote-model.test.ts
- [ ] T010 [P] Write failing test for QuerySlice type in packages/core/src/__tests__/types/query-slice.test.ts
- [ ] T011 [P] Write failing test for MutationSlice type in packages/core/src/__tests__/types/mutation-slice.test.ts
- [ ] T012 [P] Write failing test for PageQuery type in packages/core/src/__tests__/types/page-query.test.ts
- [ ] T013 [P] Write failing test for FieldSelection type in packages/core/src/__tests__/types/field-selection.test.ts

### A.3: Core Package - Type Implementation (After tests fail)
- [ ] T014 [P] Implement RemoteModel interface in packages/core/src/types/remote-model.ts (copy from spec, don't import)
- [ ] T015 [P] Implement QuerySlice interface in packages/core/src/types/query-slice.ts
- [ ] T016 [P] Implement MutationSlice interface in packages/core/src/types/mutation-slice.ts
- [ ] T017 [P] Implement PageQuery interface in packages/core/src/types/page-query.ts
- [ ] T018 [P] Implement FieldSelection and helper types in packages/core/src/types/field-selection.ts
- [ ] T019 Create type index in packages/core/src/types/index.ts exporting all types

### A.4: Core Package - createGql Function (TDD)
- [ ] T020 Write failing test for createGql factory in packages/core/src/__tests__/create-gql.test.ts
- [ ] T021 Write failing test for gql.model() method in packages/core/src/__tests__/model.test.ts
- [ ] T022 Write failing test for gql.query() method in packages/core/src/__tests__/query.test.ts
- [ ] T023 Write failing test for gql.mutation() method in packages/core/src/__tests__/mutation.test.ts
- [ ] T024 Write failing test for gql.page() method in packages/core/src/__tests__/page.test.ts

### A.5: Core Package - createGql Implementation
- [ ] T025 Implement createGql factory function in packages/core/src/create-gql.ts with Generic constraints
- [ ] T026 [P] Implement model utility in packages/core/src/utilities/model.ts using neverthrow
- [ ] T027 [P] Implement query utility in packages/core/src/utilities/query.ts using neverthrow
- [ ] T028 [P] Implement mutation utility in packages/core/src/utilities/mutation.ts using neverthrow
- [ ] T029 [P] Implement page utility in packages/core/src/utilities/page.ts with deduplication logic
- [ ] T030 Create utilities index in packages/core/src/utilities/index.ts

### A.6: Core Package - Runtime Document Generation (TDD)
- [ ] T031 Write failing test for GraphQL document generation in packages/core/src/__tests__/document-generator.test.ts
- [ ] T032 Write failing test for field selection merging in packages/core/src/__tests__/field-merger.test.ts
- [ ] T033 Write failing test for argument mapping in packages/core/src/__tests__/argument-mapper.test.ts

### A.7: Core Package - Runtime Document Implementation
- [ ] T034 Implement document generator in packages/core/src/runtime/document-generator.ts
- [ ] T035 Implement field merger in packages/core/src/runtime/field-merger.ts
- [ ] T036 Implement argument mapper in packages/core/src/runtime/argument-mapper.ts
- [ ] T037 Create runtime index in packages/core/src/runtime/index.ts

### A.8: Core Package - Integration Tests
- [ ] T038 Write integration test for complete RemoteModel flow in packages/core/src/__tests__/integration/remote-model.test.ts
- [ ] T039 Write integration test for QuerySlice composition in packages/core/src/__tests__/integration/query-slice.test.ts
- [ ] T040 Write integration test for PageQuery merging in packages/core/src/__tests__/integration/page-query.test.ts
- [ ] T041 Create core package index in packages/core/src/index.ts exporting public API

## Phase B: Code Generation System

### B.1: Codegen Package - Schema Parser (TDD)
- [ ] T042 [P] Write failing test for GraphQL schema parsing in packages/codegen/src/__tests__/schema-parser.test.ts
- [ ] T043 [P] Write failing test for TypeScript type generation in packages/codegen/src/__tests__/type-generator.test.ts
- [ ] T044 [P] Write failing test for enum generation in packages/codegen/src/__tests__/enum-generator.test.ts
- [ ] T045 [P] Write failing test for input type generation in packages/codegen/src/__tests__/input-generator.test.ts

### B.2: Codegen Package - Schema Parser Implementation
- [ ] T046 Implement schema parser with zod validation in packages/codegen/src/parsers/schema-parser.ts
- [ ] T047 [P] Implement type generator in packages/codegen/src/generators/type-generator.ts
- [ ] T048 [P] Implement enum generator in packages/codegen/src/generators/enum-generator.ts
- [ ] T049 [P] Implement input generator in packages/codegen/src/generators/input-generator.ts

### B.3: Codegen Package - System Generation (TDD)
- [ ] T050 Write failing test for graphql-system structure in packages/codegen/src/__tests__/system-generator.test.ts
- [ ] T051 Write failing test for gql instance generation in packages/codegen/src/__tests__/gql-generator.test.ts
- [ ] T052 Write failing test for template rendering in packages/codegen/src/__tests__/template-renderer.test.ts

### B.4: Codegen Package - System Generation Implementation
- [ ] T053 Implement system generator in packages/codegen/src/generators/system-generator.ts
- [ ] T054 Implement gql instance generator in packages/codegen/src/generators/gql-generator.ts
- [ ] T055 Implement template renderer in packages/codegen/src/templates/template-renderer.ts
- [ ] T056 [P] Create TypeScript templates in packages/codegen/src/templates/
- [ ] T057 Create codegen index in packages/codegen/src/index.ts

## Phase C: Static Analysis & Builder

### C.1: Builder Package - AST Analysis (TDD)
- [ ] T058 [P] Write failing test for TypeScript AST parsing in packages/builder/src/__tests__/ast-parser.test.ts
- [ ] T059 [P] Write failing test for gql usage extraction in packages/builder/src/__tests__/usage-extractor.test.ts
- [ ] T060 [P] Write failing test for dependency resolution in packages/builder/src/__tests__/dependency-resolver.test.ts

### C.2: Builder Package - AST Analysis Implementation
- [ ] T061 Implement AST parser using TypeScript Compiler API in packages/builder/src/analysis/ast-parser.ts
- [ ] T062 Implement usage extractor in packages/builder/src/analysis/usage-extractor.ts
- [ ] T063 Implement dependency resolver with {file}::{export}::{property} format in packages/builder/src/analysis/dependency-resolver.ts

### C.3: Builder Package - Code Generation (TDD)
- [ ] T064 Write failing test for executable code generation in packages/builder/src/__tests__/code-generator.test.ts
- [ ] T065 Write failing test for refs object generation in packages/builder/src/__tests__/refs-generator.test.ts
- [ ] T066 Write failing test for JSON output in packages/builder/src/__tests__/json-output.test.ts

### C.4: Builder Package - Code Generation Implementation
- [ ] T067 Implement executable code generator in packages/builder/src/generation/code-generator.ts
- [ ] T068 Implement refs object generator with lazy evaluation in packages/builder/src/generation/refs-generator.ts
- [ ] T069 Implement JSON output with zod validation in packages/builder/src/generation/json-output.ts
- [ ] T070 Create builder index in packages/builder/src/index.ts

## Phase D: Build Tool Integration

### D.1: Babel Plugin - Transformation (TDD)
- [ ] T071 Write failing test for Babel visitor in packages/plugin-babel/src/__tests__/visitor.test.ts
- [ ] T072 Write failing test for code replacement in packages/plugin-babel/src/__tests__/replacer.test.ts
- [ ] T073 Write failing test for top-level hoisting in packages/plugin-babel/src/__tests__/hoister.test.ts

### D.2: Babel Plugin - Implementation
- [ ] T074 Implement Babel plugin entry in packages/plugin-babel/src/index.ts
- [ ] T075 Implement visitor pattern in packages/plugin-babel/src/visitor.ts
- [ ] T076 Implement code replacer in packages/plugin-babel/src/replacer.ts
- [ ] T077 Implement query hoister in packages/plugin-babel/src/hoister.ts
- [ ] T078 Add builder integration in packages/plugin-babel/src/builder-integration.ts

### D.3: Plugin Testing
- [ ] T079 Create example React app in examples/basic/
- [ ] T080 Write E2E test for zero-runtime transformation in tests/e2e/babel-plugin.test.ts
- [ ] T081 Write performance benchmark in tests/performance/build-time.test.ts

## Phase E: CLI & Developer Experience

### E.1: CLI Package - Commands (TDD)
- [ ] T082 [P] Write failing test for init command in packages/cli/src/__tests__/commands/init.test.ts
- [ ] T083 [P] Write failing test for generate command in packages/cli/src/__tests__/commands/generate.test.ts
- [ ] T084 [P] Write failing test for check command in packages/cli/src/__tests__/commands/check.test.ts

### E.2: CLI Package - Implementation
- [ ] T085 Implement CLI entry point in packages/cli/src/index.ts with commander
- [ ] T086 [P] Implement init command in packages/cli/src/commands/init.ts
- [ ] T087 [P] Implement generate command in packages/cli/src/commands/generate.ts using codegen
- [ ] T088 [P] Implement check command in packages/cli/src/commands/check.ts
- [ ] T089 Implement config loader with zod in packages/cli/src/config/loader.ts
- [ ] T090 Add error handling with neverthrow in packages/cli/src/utils/error-handler.ts

### E.3: Documentation & Examples
- [ ] T091 [P] Create README.md for each package with usage examples
- [ ] T092 [P] Create advanced example in examples/advanced/ with cross-module composition
- [ ] T093 [P] Write API documentation in docs/api.md
- [ ] T094 [P] Create migration guide in docs/migration.md
- [ ] T095 Update root README.md with quickstart guide

### E.4: Final Integration & Polish
- [ ] T096 Run full integration test suite across all packages
- [ ] T097 Performance optimization based on benchmarks
- [ ] T098 Add GitHub Actions CI/CD workflow in .github/workflows/ci.yml
- [ ] T099 Configure changesets for versioning in .changeset/
- [ ] T100 Final review and cleanup of all TODO comments

## Dependencies

### Critical Dependencies:
- **Phase A before all**: Core runtime must exist first
- **Tests before implementation**: Every implementation task requires its test to fail first
- **Phase A → B → C → D → E**: Sequential phase execution
- T001-T008 (setup) blocks everything
- T009-T013 (type tests) before T014-T019 (type implementation)
- T020-T024 (createGql tests) before T025-T030 (createGql implementation)
- T025 (createGql) blocks T026-T030 (utilities)
- T042-T045 (codegen tests) before T046-T049 (codegen implementation)
- T061-T063 (AST) required for T067-T069 (code generation)
- T074-T078 (Babel plugin) requires builder package complete
- T085-T090 (CLI) requires codegen package complete

### Parallel Execution Examples

```bash
# Phase A.2 - Type tests (all different files)
Task agent="test-writer" task="Write failing test for RemoteModel type in packages/core/src/__tests__/types/remote-model.test.ts"
Task agent="test-writer" task="Write failing test for QuerySlice type in packages/core/src/__tests__/types/query-slice.test.ts"
Task agent="test-writer" task="Write failing test for MutationSlice type in packages/core/src/__tests__/types/mutation-slice.test.ts"
Task agent="test-writer" task="Write failing test for PageQuery type in packages/core/src/__tests__/types/page-query.test.ts"

# Phase A.3 - Type implementations (all different files)
Task agent="type-implementer" task="Implement RemoteModel interface in packages/core/src/types/remote-model.ts"
Task agent="type-implementer" task="Implement QuerySlice interface in packages/core/src/types/query-slice.ts"
Task agent="type-implementer" task="Implement MutationSlice interface in packages/core/src/types/mutation-slice.ts"
Task agent="type-implementer" task="Implement PageQuery interface in packages/core/src/types/page-query.ts"

# Phase B.1 - Codegen tests (all different files)
Task agent="test-writer" task="Write failing test for schema parsing in packages/codegen/src/__tests__/schema-parser.test.ts"
Task agent="test-writer" task="Write failing test for type generation in packages/codegen/src/__tests__/type-generator.test.ts"
Task agent="test-writer" task="Write failing test for enum generation in packages/codegen/src/__tests__/enum-generator.test.ts"
```

## Validation Checklist
- [x] All contracts (runtime-api.ts, plugin-api.ts) have corresponding type definitions
- [x] All entities (RemoteModel, QuerySlice, MutationSlice, PageQuery) have implementation tasks
- [x] All tests come before implementation (TDD enforced)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No parallel task modifies same file as another [P] task
- [x] Never imports from /specs/ directory (explicit warnings added)
- [x] Uses workspace protocol for internal dependencies
- [x] No file extensions in imports
- [x] Direct TypeScript references between packages

## Notes
- Total tasks: 100 (comprehensive coverage of all 5 phases)
- Estimated completion: 2-3 weeks with parallel execution
- Critical path: A.1 → A.4 → A.5 → B.3 → B.4 → C.3 → C.4 → D.2 → E.2
- Each phase builds on previous, no skipping allowed
- Commit after each task with descriptive message
- Run tests continuously to ensure nothing breaks