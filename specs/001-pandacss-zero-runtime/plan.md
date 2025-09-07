# Implementation Plan: Zero-runtime GraphQL Query Generation

**Branch**: `001-pandacss-zero-runtime` | **Date**: 2025-01-07 | **Spec**: [link](./spec.md)
**Input**: Feature specification from `/specs/001-pandacss-zero-runtime/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement a zero-runtime GraphQL query generation system that transforms TypeScript-defined queries into optimized GraphQL documents at build time, similar to PandaCSS's approach to CSS-in-JS. The system enables type-safe GraphQL operations with full inference, parameterized fragments, and cross-module query composition while maintaining zero runtime overhead.

## Technical Context
**Language/Version**: TypeScript 5.x / Bun 1.0+  
**Primary Dependencies**: zod (validation), neverthrow (error handling), TypeScript Compiler API (analysis)  
**Storage**: N/A (build-time transformation only)  
**Testing**: bun test with TDD (t_wada methodology)  
**Target Platform**: Node.js/Bun build environments  
**Project Type**: single (library with CLI)  
**Performance Goals**: < 100ms per file transformation, < 500ms incremental builds  
**Constraints**: Zero runtime overhead, full type safety, no manual code generation  
**Scale/Scope**: Support for 1000+ files, 100+ slices per page

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (core library, build plugin)
- Using framework directly? Yes (TypeScript Compiler API, no wrappers)
- Single data model? Yes (GraphQL schema as single source)
- Avoiding patterns? Yes (no Repository/UoW, direct transformations)

**Architecture**:
- EVERY feature as library? Yes
- Libraries listed:
  - `@soda-gql/core`: Runtime API and type definitions
  - `@soda-gql/plugin-bun`: Build-time transformation plugin
  - `@soda-gql/cli`: Command-line interface for generation
- CLI per library:
  - core: `soda-gql generate --schema --output --format`
  - plugin: Configuration via bunfig.toml
  - cli: `soda-gql --help --version --format`
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual TypeScript compiler, real GraphQL parser)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (build-time diagnostics)
- Frontend logs → backend? N/A (build tool only)
- Error context sufficient? Yes (file, line, transformation phase)

**Versioning**:
- Version number assigned? 0.1.0
- BUILD increments on every change? Yes
- Breaking changes handled? Semantic versioning, migration guides

## Project Structure

### Documentation (this feature)
```
specs/001-pandacss-zero-runtime/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✓
├── data-model.md        # Phase 1 output (/plan command) ✓
├── quickstart.md        # Phase 1 output (/plan command) ✓
├── contracts/           # Phase 1 output (/plan command) ✓
│   ├── plugin-api.ts    # Build plugin contract ✓
│   └── runtime-api.ts   # Runtime API contract ✓
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (SELECTED - library with plugin)
src/
├── models/
│   └── config.model.ts      # Configuration schemas
├── services/
│   ├── analyzer.service.ts  # AST analysis
│   ├── generator.service.ts # Query generation
│   └── registry.service.ts  # Document registration
├── cli/
│   └── commands/            # CLI commands
└── lib/
    ├── core/                # Core API
    ├── plugin/              # Build plugin
    └── transforms/          # AST transformations

tests/
├── contract/
│   ├── plugin-api.test.ts
│   └── runtime-api.test.ts
├── integration/
│   ├── transform.test.ts
│   └── generation.test.ts
└── unit/
    └── services/

packages/
├── core/                    # @soda-gql/core package
├── plugin-bun/             # @soda-gql/plugin-bun package
└── cli/                    # @soda-gql/cli package
```

**Structure Decision**: Option 1 (Single project) - Library with build plugin, organized as monorepo with separate packages

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - ✓ TypeScript Compiler API usage patterns
   - ✓ Bun plugin system architecture
   - ✓ PandaCSS transformation approach
   - ✓ Zod schema inference patterns
   - ✓ Neverthrow Result composition

2. **Generate and dispatch research agents**:
   - ✓ Research TypeScript AST manipulation
   - ✓ Research build-time code generation
   - ✓ Research type inference strategies
   - ✓ Research cross-module dependency resolution

3. **Consolidate findings** in `research.md`:
   - ✓ All technical decisions documented
   - ✓ Architecture patterns identified
   - ✓ Performance targets established

**Output**: research.md with all NEEDS CLARIFICATION resolved ✓

## Phase 1: Design & Contracts
*Prerequisites: research.md complete ✓*

1. **Extract entities from feature spec** → `data-model.md`:
   - ✓ RemoteModel, QuerySlice, MutationSlice, SubscriptionSlice
   - ✓ PageQuery, FieldSelection, TransformFunction
   - ✓ GraphQLDocument, Registration

2. **Generate API contracts** from functional requirements:
   - ✓ Plugin API contract (build-time interface)
   - ✓ Runtime API contract (developer-facing API)
   - ✓ Type definitions for all entities

3. **Generate contract tests** from contracts:
   - Tests to be created in Phase 3 (implementation)
   - One test file per API surface
   - Schema validation tests

4. **Extract test scenarios** from user stories:
   - ✓ Remote Model definition and inference
   - ✓ Query Slice composition
   - ✓ Page Query generation
   - ✓ Transform function execution
   - ✓ Registration and deduplication

5. **Update agent file incrementally**:
   - ✓ Updated CLAUDE.md with project context
   - ✓ Added tech stack and commands
   - ✓ Documented key concepts

**Output**: data-model.md ✓, /contracts/* ✓, quickstart.md ✓, CLAUDE.md ✓

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Task Categories**:
1. **Contract Tests** (TDD Red Phase):
   - Plugin API contract tests
   - Runtime API contract tests
   - Type inference tests

2. **Core Implementation**:
   - AST analyzer service
   - Query generator service
   - Document registry service
   - Transform executor

3. **Plugin Implementation**:
   - Bun plugin hooks
   - File transformation pipeline
   - Cache management
   - Error reporting

4. **CLI Implementation**:
   - Generate command
   - Validate command
   - Init command

5. **Integration Tests**:
   - End-to-end transformation
   - Cross-module composition
   - Performance benchmarks

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Core → Plugin → CLI
- Mark [P] for parallel execution (independent modules)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md covering:
- 8-10 contract/unit test tasks
- 12-15 implementation tasks
- 5-8 integration test tasks
- 2-3 documentation tasks

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following TDD principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | - | - |

No constitutional violations. The design maintains simplicity with only 2 projects (core library and plugin), uses frameworks directly without wrappers, and follows TDD principles strictly.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*