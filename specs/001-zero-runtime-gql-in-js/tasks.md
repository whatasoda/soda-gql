# Tasks: Zero-runtime GraphQL Query Generation System (v2)

**Input**: Design documents from `/specs/001-zero-runtime-gql-in-js/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **CRITICAL**: Never import from `/specs/` - copy types to packages
- **Quality Checks**: Run `bun run quality` after each sub-phase

## Path Conventions

- Monorepo structure with packages/
- Direct TypeScript imports between packages (no build step initially)
- No file extensions in imports

## Phase A: Runtime Implementation (Foundation)

### A.1: Project Setup

- [x] T001 Initialize monorepo with Bun workspaces in package.json
- [x] T002 Create base TypeScript configuration files (tsconfig.json, tsconfig.base.json)
- [x] T003 [P] Create package directories: packages/core, packages/codegen, packages/builder, packages/plugin-babel, packages/cli
- [x] T004 [P] Initialize package.json for each package with workspace protocol dependencies
- [x] T005 Configure tsconfig.json in each package extending ../../tsconfig.base.json
- [x] T006 [P] Install core dependencies: bun add neverthrow zod@4
- [x] T007 Setup Biome v2 for linting and formatting: bun add -D @biomejs/biome@2
- [x] T008 Configure biome.json with TypeScript, import sorting, and formatting rules
- [x] T009 Add root package.json scripts: "typecheck": "bun --filter='\*' typecheck", "biome:check": "biome check --write .", "quality": "bun run biome:check && bun run typecheck"
- [x] T010 Create .gitignore with node_modules, dist, coverage patterns
- [x] T011 Run initial quality check: bun run quality

### A.2: Core Package - Type Definitions (TDD - Tests First)

**CRITICAL: Write tests first, they MUST fail before implementation**

- [x] T012 [P] Write failing test for RemoteModel type in packages/core/src/**tests**/types/remote-model.test.ts
- [x] T013 [P] Write failing test for QuerySlice type in packages/core/src/**tests**/types/query-slice.test.ts
- [x] T014 [P] Write failing test for MutationSlice type in packages/core/src/**tests**/types/mutation-slice.test.ts
- [x] T015 [P] Write failing test for PageQuery type in packages/core/src/**tests**/types/page-query.test.ts
- [x] T016 [P] Write failing test for FieldSelection type in packages/core/src/**tests**/types/field-selection.test.ts
- [x] T017 Quality check: bun run quality

### A.3: Core Package - Type Implementation (After tests fail)

- [x] T018 [P] Implement RemoteModel interface in packages/core/src/types/remote-model.ts (copy from spec, don't import)
- [x] T019 [P] Implement QuerySlice interface in packages/core/src/types/query-slice.ts
- [x] T020 [P] Implement MutationSlice interface in packages/core/src/types/mutation-slice.ts
- [x] T021 [P] Implement PageQuery interface in packages/core/src/types/page-query.ts
- [x] T022 [P] Implement FieldSelection and helper types in packages/core/src/types/field-selection.ts
- [x] T023 Create type index in packages/core/src/types/index.ts exporting all types
- [x] T024 Quality check: bun run quality

### A.4: Core Package - createGql Function (TDD)

- [ ] T025 Write failing test for createGql factory in packages/core/src/**tests**/create-gql.test.ts
- [ ] T026 Write failing test for gql.model() method in packages/core/src/**tests**/model.test.ts
- [ ] T027 Write failing test for gql.query() method in packages/core/src/**tests**/query.test.ts
- [ ] T028 Write failing test for gql.mutation() method in packages/core/src/**tests**/mutation.test.ts
- [ ] T029 Write failing test for gql.page() method in packages/core/src/**tests**/page.test.ts
- [ ] T030 Quality check: bun run quality

### A.5: Core Package - createGql Implementation

- [ ] T031 Implement createGql factory function in packages/core/src/create-gql.ts with Generic constraints
- [ ] T032 [P] Implement model utility in packages/core/src/utilities/model.ts using neverthrow
- [ ] T033 [P] Implement query utility in packages/core/src/utilities/query.ts using neverthrow
- [ ] T034 [P] Implement mutation utility in packages/core/src/utilities/mutation.ts using neverthrow
- [ ] T035 [P] Implement page utility in packages/core/src/utilities/page.ts with deduplication logic
- [ ] T036 Create utilities index in packages/core/src/utilities/index.ts
- [ ] T037 Quality check: bun run quality

### A.6: Core Package - Runtime Document Generation (TDD)

- [ ] T038 Write failing test for GraphQL document generation in packages/core/src/**tests**/document-generator.test.ts
- [ ] T039 Write failing test for field selection merging in packages/core/src/**tests**/field-merger.test.ts
- [ ] T040 Write failing test for argument mapping in packages/core/src/**tests**/argument-mapper.test.ts
- [ ] T041 Quality check: bun run quality

### A.7: Core Package - Runtime Document Implementation

- [ ] T042 Implement document generator in packages/core/src/runtime/document-generator.ts
- [ ] T043 Implement field merger in packages/core/src/runtime/field-merger.ts
- [ ] T044 Implement argument mapper in packages/core/src/runtime/argument-mapper.ts
- [ ] T045 Create runtime index in packages/core/src/runtime/index.ts
- [ ] T046 Quality check: bun run quality

### A.8: Core Package - Integration Tests

- [ ] T047 Write integration test for complete RemoteModel flow in packages/core/src/**tests**/integration/remote-model.test.ts
- [ ] T048 Write integration test for QuerySlice composition in packages/core/src/**tests**/integration/query-slice.test.ts
- [ ] T049 Write integration test for PageQuery merging in packages/core/src/**tests**/integration/page-query.test.ts
- [ ] T050 Create core package index in packages/core/src/index.ts exporting public API
- [ ] T051 Final quality check for Phase A: bun run quality

## Phase B: Code Generation System

### B.1: Codegen Package - Schema Parser (TDD)

- [ ] T052 [P] Write failing test for GraphQL schema parsing in packages/codegen/src/**tests**/schema-parser.test.ts
- [ ] T053 [P] Write failing test for TypeScript type generation in packages/codegen/src/**tests**/type-generator.test.ts
- [ ] T054 [P] Write failing test for enum generation in packages/codegen/src/**tests**/enum-generator.test.ts
- [ ] T055 [P] Write failing test for input type generation in packages/codegen/src/**tests**/input-generator.test.ts
- [ ] T056 Quality check: bun run quality

### B.2: Codegen Package - Schema Parser Implementation

- [ ] T057 Implement schema parser with zod validation in packages/codegen/src/parsers/schema-parser.ts
- [ ] T058 [P] Implement type generator in packages/codegen/src/generators/type-generator.ts
- [ ] T059 [P] Implement enum generator in packages/codegen/src/generators/enum-generator.ts
- [ ] T060 [P] Implement input generator in packages/codegen/src/generators/input-generator.ts
- [ ] T061 Quality check: bun run quality

### B.3: Codegen Package - System Generation (TDD)

- [ ] T062 Write failing test for graphql-system structure in packages/codegen/src/**tests**/system-generator.test.ts
- [ ] T063 Write failing test for gql instance generation in packages/codegen/src/**tests**/gql-generator.test.ts
- [ ] T064 Write failing test for template rendering in packages/codegen/src/**tests**/template-renderer.test.ts
- [ ] T065 Quality check: bun run quality

### B.4: Codegen Package - System Generation Implementation

- [ ] T066 Implement system generator in packages/codegen/src/generators/system-generator.ts
- [ ] T067 Implement gql instance generator in packages/codegen/src/generators/gql-generator.ts
- [ ] T068 Implement template renderer in packages/codegen/src/templates/template-renderer.ts
- [ ] T069 [P] Create TypeScript templates in packages/codegen/src/templates/
- [ ] T070 Create codegen index in packages/codegen/src/index.ts
- [ ] T071 Final quality check for Phase B: bun run quality

## Phase C: Static Analysis & Builder

### C.1: Builder Package - AST Analysis (TDD)

- [ ] T072 [P] Write failing test for TypeScript AST parsing in packages/builder/src/**tests**/ast-parser.test.ts
- [ ] T073 [P] Write failing test for gql usage extraction in packages/builder/src/**tests**/usage-extractor.test.ts
- [ ] T074 [P] Write failing test for dependency resolution in packages/builder/src/**tests**/dependency-resolver.test.ts
- [ ] T075 Quality check: bun run quality

### C.2: Builder Package - AST Analysis Implementation

- [ ] T076 Implement AST parser using TypeScript Compiler API in packages/builder/src/analysis/ast-parser.ts
- [ ] T077 Implement usage extractor in packages/builder/src/analysis/usage-extractor.ts
- [ ] T078 Implement dependency resolver with {file}::{export}::{property} format in packages/builder/src/analysis/dependency-resolver.ts
- [ ] T079 Quality check: bun run quality

### C.3: Builder Package - Code Generation (TDD)

- [ ] T080 Write failing test for executable code generation in packages/builder/src/**tests**/code-generator.test.ts
- [ ] T081 Write failing test for refs object generation in packages/builder/src/**tests**/refs-generator.test.ts
- [ ] T082 Write failing test for JSON output in packages/builder/src/**tests**/json-output.test.ts
- [ ] T083 Quality check: bun run quality

### C.4: Builder Package - Code Generation Implementation

- [ ] T084 Implement executable code generator in packages/builder/src/generation/code-generator.ts
- [ ] T085 Implement refs object generator with lazy evaluation in packages/builder/src/generation/refs-generator.ts
- [ ] T086 Implement JSON output with zod validation in packages/builder/src/generation/json-output.ts
- [ ] T087 Create builder index in packages/builder/src/index.ts
- [ ] T088 Final quality check for Phase C: bun run quality

## Phase D: Build Tool Integration

### D.1: Babel Plugin - Transformation (TDD)

- [ ] T089 Write failing test for Babel visitor in packages/plugin-babel/src/**tests**/visitor.test.ts
- [ ] T090 Write failing test for code replacement in packages/plugin-babel/src/**tests**/replacer.test.ts
- [ ] T091 Write failing test for top-level hoisting in packages/plugin-babel/src/**tests**/hoister.test.ts
- [ ] T092 Quality check: bun run quality

### D.2: Babel Plugin - Implementation

- [ ] T093 Implement Babel plugin entry in packages/plugin-babel/src/index.ts
- [ ] T094 Implement visitor pattern in packages/plugin-babel/src/visitor.ts
- [ ] T095 Implement code replacer in packages/plugin-babel/src/replacer.ts
- [ ] T096 Implement query hoister in packages/plugin-babel/src/hoister.ts
- [ ] T097 Add builder integration in packages/plugin-babel/src/builder-integration.ts
- [ ] T098 Quality check: bun run quality

### D.3: Plugin Testing

- [ ] T099 Create example React app in examples/basic/
- [ ] T100 Write E2E test for zero-runtime transformation in tests/e2e/babel-plugin.test.ts
- [ ] T101 Write performance benchmark in tests/performance/build-time.test.ts
- [ ] T102 Final quality check for Phase D: bun run quality

## Phase E: CLI & Developer Experience

### E.1: CLI Package - Commands (TDD)

- [ ] T103 [P] Write failing test for init command in packages/cli/src/**tests**/commands/init.test.ts
- [ ] T104 [P] Write failing test for generate command in packages/cli/src/**tests**/commands/generate.test.ts
- [ ] T105 [P] Write failing test for check command in packages/cli/src/**tests**/commands/check.test.ts
- [ ] T106 Quality check: bun run quality

### E.2: CLI Package - Implementation

- [ ] T107 Implement CLI entry point in packages/cli/src/index.ts with commander
- [ ] T108 [P] Implement init command in packages/cli/src/commands/init.ts
- [ ] T109 [P] Implement generate command in packages/cli/src/commands/generate.ts using codegen
- [ ] T110 [P] Implement check command in packages/cli/src/commands/check.ts
- [ ] T111 Implement config loader with zod in packages/cli/src/config/loader.ts
- [ ] T112 Add error handling with neverthrow in packages/cli/src/utils/error-handler.ts
- [ ] T113 Quality check: bun run quality

### E.3: Documentation & Examples

- [ ] T114 [P] Create README.md for each package with usage examples
- [ ] T115 [P] Create advanced example in examples/advanced/ with cross-module composition
- [ ] T116 [P] Write API documentation in docs/api.md
- [ ] T117 [P] Create migration guide in docs/migration.md
- [ ] T118 Update root README.md with quickstart guide
- [ ] T119 Quality check: bun run quality

### E.4: Final Integration & Polish

- [ ] T120 Run full integration test suite across all packages
- [ ] T121 Performance optimization based on benchmarks
- [ ] T122 Add GitHub Actions CI/CD workflow in .github/workflows/ci.yml
- [ ] T123 Configure changesets for versioning in .changeset/
- [ ] T124 Final review and cleanup of all TODO comments
- [ ] T125 Final quality check for entire project: bun run quality && bun test

## Dependencies

### Critical Dependencies:

- **Phase A before all**: Core runtime must exist first
- **Tests before implementation**: Every implementation task requires its test to fail first
- **Quality checks**: Each sub-phase must pass Biome and type checks before proceeding
- **Phase A → B → C → D → E**: Sequential phase execution
- T001-T011 (setup with Biome v2) blocks everything
- T012-T017 (type tests + check) before T018-T024 (type implementation + check)
- T025-T030 (createGql tests + check) before T031-T037 (createGql implementation + check)
- T031 (createGql) blocks T032-T036 (utilities)
- T052-T056 (codegen tests + check) before T057-T061 (codegen implementation + check)
- T076-T079 (AST + check) required for T084-T088 (code generation + check)
- T093-T098 (Babel plugin + check) requires builder package complete
- T107-T113 (CLI + check) requires codegen package complete

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
- [x] Biome v2 setup included
- [x] Quality checks after each sub-phase

## Notes

- Total tasks: 125 (comprehensive coverage with quality checks)
- Biome v2 setup and configuration included
- Quality checks after each sub-phase ensure code consistency
- Estimated completion: 2-3 weeks with parallel execution
- Critical path: A.1 → A.4 → A.5 → B.3 → B.4 → C.3 → C.4 → D.2 → E.2
- Each phase builds on previous, no skipping allowed
- Commit after each task with descriptive message
- Run tests continuously to ensure nothing breaks
- Biome check --write automatically fixes formatting and import sorting
- Type checking ensures no TypeScript errors accumulate
- `bun run quality` combines both Biome and TypeScript checks
- Commit after each task with descriptive message
- Update tasks.md and mark tasks as complete after each task
