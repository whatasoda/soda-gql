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
- [ ] T007 Setup Biome v2 for linting and formatting: bun add -D @biomejs/biome@2
- [ ] T008 Configure biome.json with TypeScript, import sorting, and formatting rules
- [ ] T009 Add root package.json scripts: "typecheck": "tsc --noEmit", "biome:check": "biome check --write .", "quality": "bun run biome:check && bun run typecheck"
- [ ] T010 Create .gitignore with node_modules, dist, coverage patterns
- [ ] T011 Run initial quality check: bun run quality

### A.2: Core Package - Type Definitions (TDD - Tests First)
**CRITICAL: Write tests first, they MUST fail before implementation**

- [ ] T012 [P] Write failing test for RemoteModel type in packages/core/src/__tests__/types/remote-model.test.ts
- [ ] T013 [P] Write failing test for QuerySlice type in packages/core/src/__tests__/types/query-slice.test.ts
- [ ] T014 [P] Write failing test for MutationSlice type in packages/core/src/__tests__/types/mutation-slice.test.ts
- [ ] T015 [P] Write failing test for PageQuery type in packages/core/src/__tests__/types/page-query.test.ts
- [ ] T016 [P] Write failing test for FieldSelection type in packages/core/src/__tests__/types/field-selection.test.ts
- [ ] T017 Quality check: bun run quality

### A.3: Core Package - Type Implementation (After tests fail)
- [ ] T018 [P] Implement RemoteModel interface in packages/core/src/types/remote-model.ts (copy from spec, don't import)
- [ ] T019 [P] Implement QuerySlice interface in packages/core/src/types/query-slice.ts
- [ ] T020 [P] Implement MutationSlice interface in packages/core/src/types/mutation-slice.ts
- [ ] T021 [P] Implement PageQuery interface in packages/core/src/types/page-query.ts
- [ ] T022 [P] Implement FieldSelection and helper types in packages/core/src/types/field-selection.ts
- [ ] T023 Create type index in packages/core/src/types/index.ts exporting all types
- [ ] T024 Quality check: bun run quality

### A.4: Core Package - createGql Function (TDD)
- [ ] T024 Write failing test for createGql factory in packages/core/src/__tests__/create-gql.test.ts
- [ ] T025 Write failing test for gql.model() method in packages/core/src/__tests__/model.test.ts
- [ ] T026 Write failing test for gql.query() method in packages/core/src/__tests__/query.test.ts
- [ ] T027 Write failing test for gql.mutation() method in packages/core/src/__tests__/mutation.test.ts
- [ ] T028 Write failing test for gql.page() method in packages/core/src/__tests__/page.test.ts
- [ ] T030 Quality check: bun run quality

### A.5: Core Package - createGql Implementation
- [ ] T030 Implement createGql factory function in packages/core/src/create-gql.ts with Generic constraints
- [ ] T031 [P] Implement model utility in packages/core/src/utilities/model.ts using neverthrow
- [ ] T032 [P] Implement query utility in packages/core/src/utilities/query.ts using neverthrow
- [ ] T033 [P] Implement mutation utility in packages/core/src/utilities/mutation.ts using neverthrow
- [ ] T034 [P] Implement page utility in packages/core/src/utilities/page.ts with deduplication logic
- [ ] T035 Create utilities index in packages/core/src/utilities/index.ts
- [ ] T037 Quality check: bun run quality

### A.6: Core Package - Runtime Document Generation (TDD)
- [ ] T037 Write failing test for GraphQL document generation in packages/core/src/__tests__/document-generator.test.ts
- [ ] T038 Write failing test for field selection merging in packages/core/src/__tests__/field-merger.test.ts
- [ ] T039 Write failing test for argument mapping in packages/core/src/__tests__/argument-mapper.test.ts
- [ ] T041 Quality check: bun run quality

### A.7: Core Package - Runtime Document Implementation
- [ ] T041 Implement document generator in packages/core/src/runtime/document-generator.ts
- [ ] T042 Implement field merger in packages/core/src/runtime/field-merger.ts
- [ ] T043 Implement argument mapper in packages/core/src/runtime/argument-mapper.ts
- [ ] T044 Create runtime index in packages/core/src/runtime/index.ts
- [ ] T046 Quality check: bun run quality

### A.8: Core Package - Integration Tests
- [ ] T046 Write integration test for complete RemoteModel flow in packages/core/src/__tests__/integration/remote-model.test.ts
- [ ] T047 Write integration test for QuerySlice composition in packages/core/src/__tests__/integration/query-slice.test.ts
- [ ] T048 Write integration test for PageQuery merging in packages/core/src/__tests__/integration/page-query.test.ts
- [ ] T049 Create core package index in packages/core/src/index.ts exporting public API
- [ ] T051 Final quality check for Phase A: bun run quality

## Phase B: Code Generation System

### B.1: Codegen Package - Schema Parser (TDD)
- [ ] T051 [P] Write failing test for GraphQL schema parsing in packages/codegen/src/__tests__/schema-parser.test.ts
- [ ] T052 [P] Write failing test for TypeScript type generation in packages/codegen/src/__tests__/type-generator.test.ts
- [ ] T053 [P] Write failing test for enum generation in packages/codegen/src/__tests__/enum-generator.test.ts
- [ ] T054 [P] Write failing test for input type generation in packages/codegen/src/__tests__/input-generator.test.ts
- [ ] T055 Quality check: bun run biome check --write packages/codegen && bun run typecheck

### B.2: Codegen Package - Schema Parser Implementation
- [ ] T056 Implement schema parser with zod validation in packages/codegen/src/parsers/schema-parser.ts
- [ ] T057 [P] Implement type generator in packages/codegen/src/generators/type-generator.ts
- [ ] T058 [P] Implement enum generator in packages/codegen/src/generators/enum-generator.ts
- [ ] T059 [P] Implement input generator in packages/codegen/src/generators/input-generator.ts
- [ ] T060 Quality check: bun run biome check --write packages/codegen && bun run typecheck

### B.3: Codegen Package - System Generation (TDD)
- [ ] T061 Write failing test for graphql-system structure in packages/codegen/src/__tests__/system-generator.test.ts
- [ ] T062 Write failing test for gql instance generation in packages/codegen/src/__tests__/gql-generator.test.ts
- [ ] T063 Write failing test for template rendering in packages/codegen/src/__tests__/template-renderer.test.ts
- [ ] T064 Quality check: bun run biome check --write packages/codegen && bun run typecheck

### B.4: Codegen Package - System Generation Implementation
- [ ] T065 Implement system generator in packages/codegen/src/generators/system-generator.ts
- [ ] T066 Implement gql instance generator in packages/codegen/src/generators/gql-generator.ts
- [ ] T067 Implement template renderer in packages/codegen/src/templates/template-renderer.ts
- [ ] T068 [P] Create TypeScript templates in packages/codegen/src/templates/
- [ ] T069 Create codegen index in packages/codegen/src/index.ts
- [ ] T070 Final quality check for Phase B: bun run biome check --write . && bun run typecheck

## Phase C: Static Analysis & Builder

### C.1: Builder Package - AST Analysis (TDD)
- [ ] T071 [P] Write failing test for TypeScript AST parsing in packages/builder/src/__tests__/ast-parser.test.ts
- [ ] T072 [P] Write failing test for gql usage extraction in packages/builder/src/__tests__/usage-extractor.test.ts
- [ ] T073 [P] Write failing test for dependency resolution in packages/builder/src/__tests__/dependency-resolver.test.ts
- [ ] T074 Quality check: bun run biome check --write packages/builder && bun run typecheck

### C.2: Builder Package - AST Analysis Implementation
- [ ] T075 Implement AST parser using TypeScript Compiler API in packages/builder/src/analysis/ast-parser.ts
- [ ] T076 Implement usage extractor in packages/builder/src/analysis/usage-extractor.ts
- [ ] T077 Implement dependency resolver with {file}::{export}::{property} format in packages/builder/src/analysis/dependency-resolver.ts
- [ ] T078 Quality check: bun run biome check --write packages/builder && bun run typecheck

### C.3: Builder Package - Code Generation (TDD)
- [ ] T079 Write failing test for executable code generation in packages/builder/src/__tests__/code-generator.test.ts
- [ ] T080 Write failing test for refs object generation in packages/builder/src/__tests__/refs-generator.test.ts
- [ ] T081 Write failing test for JSON output in packages/builder/src/__tests__/json-output.test.ts
- [ ] T082 Quality check: bun run biome check --write packages/builder && bun run typecheck

### C.4: Builder Package - Code Generation Implementation
- [ ] T083 Implement executable code generator in packages/builder/src/generation/code-generator.ts
- [ ] T084 Implement refs object generator with lazy evaluation in packages/builder/src/generation/refs-generator.ts
- [ ] T085 Implement JSON output with zod validation in packages/builder/src/generation/json-output.ts
- [ ] T086 Create builder index in packages/builder/src/index.ts
- [ ] T087 Final quality check for Phase C: bun run biome check --write . && bun run typecheck

## Phase D: Build Tool Integration

### D.1: Babel Plugin - Transformation (TDD)
- [ ] T088 Write failing test for Babel visitor in packages/plugin-babel/src/__tests__/visitor.test.ts
- [ ] T089 Write failing test for code replacement in packages/plugin-babel/src/__tests__/replacer.test.ts
- [ ] T090 Write failing test for top-level hoisting in packages/plugin-babel/src/__tests__/hoister.test.ts
- [ ] T091 Quality check: bun run biome check --write packages/plugin-babel && bun run typecheck

### D.2: Babel Plugin - Implementation
- [ ] T092 Implement Babel plugin entry in packages/plugin-babel/src/index.ts
- [ ] T093 Implement visitor pattern in packages/plugin-babel/src/visitor.ts
- [ ] T094 Implement code replacer in packages/plugin-babel/src/replacer.ts
- [ ] T095 Implement query hoister in packages/plugin-babel/src/hoister.ts
- [ ] T096 Add builder integration in packages/plugin-babel/src/builder-integration.ts
- [ ] T097 Quality check: bun run biome check --write packages/plugin-babel && bun run typecheck

### D.3: Plugin Testing
- [ ] T098 Create example React app in examples/basic/
- [ ] T099 Write E2E test for zero-runtime transformation in tests/e2e/babel-plugin.test.ts
- [ ] T100 Write performance benchmark in tests/performance/build-time.test.ts
- [ ] T101 Final quality check for Phase D: bun run biome check --write . && bun run typecheck

## Phase E: CLI & Developer Experience

### E.1: CLI Package - Commands (TDD)
- [ ] T102 [P] Write failing test for init command in packages/cli/src/__tests__/commands/init.test.ts
- [ ] T103 [P] Write failing test for generate command in packages/cli/src/__tests__/commands/generate.test.ts
- [ ] T104 [P] Write failing test for check command in packages/cli/src/__tests__/commands/check.test.ts
- [ ] T105 Quality check: bun run biome check --write packages/cli && bun run typecheck

### E.2: CLI Package - Implementation
- [ ] T106 Implement CLI entry point in packages/cli/src/index.ts with commander
- [ ] T107 [P] Implement init command in packages/cli/src/commands/init.ts
- [ ] T108 [P] Implement generate command in packages/cli/src/commands/generate.ts using codegen
- [ ] T109 [P] Implement check command in packages/cli/src/commands/check.ts
- [ ] T110 Implement config loader with zod in packages/cli/src/config/loader.ts
- [ ] T111 Add error handling with neverthrow in packages/cli/src/utils/error-handler.ts
- [ ] T112 Quality check: bun run biome check --write packages/cli && bun run typecheck

### E.3: Documentation & Examples
- [ ] T113 [P] Create README.md for each package with usage examples
- [ ] T114 [P] Create advanced example in examples/advanced/ with cross-module composition
- [ ] T115 [P] Write API documentation in docs/api.md
- [ ] T116 [P] Create migration guide in docs/migration.md
- [ ] T117 Update root README.md with quickstart guide
- [ ] T118 Quality check: bun run biome check --write examples && bun run typecheck

### E.4: Final Integration & Polish
- [ ] T119 Run full integration test suite across all packages
- [ ] T120 Performance optimization based on benchmarks
- [ ] T121 Add GitHub Actions CI/CD workflow in .github/workflows/ci.yml
- [ ] T122 Configure changesets for versioning in .changeset/
- [ ] T123 Final review and cleanup of all TODO comments
- [ ] T124 Final quality check for entire project: bun run biome check --write . && bun run typecheck && bun test

## Dependencies

### Critical Dependencies:
- **Phase A before all**: Core runtime must exist first
- **Tests before implementation**: Every implementation task requires its test to fail first
- **Quality checks**: Each sub-phase must pass Biome and type checks before proceeding
- **Phase A → B → C → D → E**: Sequential phase execution
- T001-T010 (setup with Biome) blocks everything
- T011-T016 (type tests + check) before T017-T023 (type implementation + check)
- T024-T029 (createGql tests + check) before T030-T036 (createGql implementation + check)
- T030 (createGql) blocks T031-T035 (utilities)
- T051-T055 (codegen tests + check) before T056-T060 (codegen implementation + check)
- T075-T078 (AST + check) required for T083-T087 (code generation + check)
- T092-T097 (Babel plugin + check) requires builder package complete
- T106-T112 (CLI + check) requires codegen package complete

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
- Total tasks: 124 (comprehensive coverage with quality checks)
- Biome v2 setup and configuration included
- Quality checks after each sub-phase ensure code consistency
- Estimated completion: 2-3 weeks with parallel execution
- Critical path: A.1 → A.4 → A.5 → B.3 → B.4 → C.3 → C.4 → D.2 → E.2
- Each phase builds on previous, no skipping allowed
- Commit after each task with descriptive message
- Run tests continuously to ensure nothing breaks
- Biome check --write automatically fixes formatting and import sorting
- Type checking ensures no TypeScript errors accumulate