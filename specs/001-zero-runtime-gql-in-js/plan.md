# Implementation Plan: Zero-runtime GraphQL Query Generation System

**Branch**: `001-zero-runtime-gql-in-js` | **Date**: 2025-09-07 | **Spec**: `/specs/001-zero-runtime-gql-in-js/spec.md`
**Input**: Feature specification from `/specs/001-zero-runtime-gql-in-js/spec.md`

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
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
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
Develop a zero-runtime GraphQL query generation system similar to PandaCSS's CSS-in-JS approach. The system allows developers to write GraphQL queries in TypeScript with full type safety, which are then statically analyzed and transformed at build time into optimized GraphQL documents. The implementation follows a phased approach: starting with runtime implementation for easier development and testing, then moving to zero-runtime with a styled-system-like generated import pattern, culminating in build tool plugins for static analysis and code transformation.

## Technical Context
**Language/Version**: TypeScript 5.x with Bun runtime  
**Primary Dependencies**: neverthrow (error handling), zod v4 (validation), Babel/AST parsers  
**Storage**: JSON files for generated GraphQL documents, file system for generated code  
**Testing**: Bun test with TDD (t_wada methodology)  
**Target Platform**: Node.js/Bun runtime, browser environments via build tools
**Project Type**: single (library with CLI and plugins)  
**Performance Goals**: Zero runtime overhead, instant type feedback during development  
**Constraints**: Must handle up to 32 slices per Page Query (warning at 16+), single schema version support  
**Scale/Scope**: Support Feature-Sliced Design architecture, multiple build tools (Babel minimum)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 5 (core, codegen, builder, plugin-babel, cli)
- Using framework directly? Yes (Babel AST directly, no wrappers)
- Single data model? Yes (GraphQL schema as single source of truth)
- Avoiding patterns? Yes (no unnecessary abstractions, direct implementation)

**Architecture**:
- EVERY feature as library? Yes (all functionality in packages)
- Libraries listed:
  - @soda-gql/core: Runtime GraphQL document generation and utilities
  - @soda-gql/codegen: Schema parsing and code generation
  - @soda-gql/builder: Static analysis and document generation
  - @soda-gql/plugin-babel: Babel plugin for code transformation
  - @soda-gql/cli: Command-line interface for schema codegen
- CLI per library: Yes (soda-gql generate, soda-gql init, etc.)
- Library docs: Yes (llms.txt format for each package)

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (TDD with t_wada methodology)
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual GraphQL schemas, real file system)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (build-time diagnostics)
- Frontend logs → backend? N/A (library, not app)
- Error context sufficient? Yes (detailed AST location info, source maps)

**Versioning**:
- Version number assigned? Yes (0.1.0 initial)
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (migration guides, deprecation warnings)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Monorepo with packages structure (modified Option 1):
```
packages/
├── core/           # Runtime GraphQL utilities
├── codegen/        # Schema code generation  
├── builder/        # Static analysis & doc generation
├── plugin-babel/   # Babel transformation plugin
└── cli/            # Command-line interface

examples/
├── basic/          # Basic usage examples
└── advanced/       # Complex scenarios

tests/
├── integration/    # Cross-package tests
└── e2e/            # End-to-end scenarios
```

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh [claude|gemini|copilot]` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

Based on the phased implementation approach specified, tasks will be organized into distinct implementation phases:

**Phase A: Runtime Implementation (Foundation)**
- Core package setup with createGql function
- Individual utility implementations (RemoteModel, QuerySlice, etc.)
- Type injection mechanism for schema types
- Unit tests for each utility (TDD approach)
- Runtime GraphQL document generation
- Integration tests for runtime execution

**Phase B: Code Generation System**
- Codegen package for schema parsing
- Type generation from GraphQL schema
- graphql-system directory generation (PandaCSS-style)
- Template generation for gql utilities
- Tests for generated code correctness

**Phase C: Static Analysis & Builder**
- Builder package for GraphQL document generation
- AST parsing for soda-gql usage extraction
- Dependency resolution system ("{file}::{export}::{property}" format)
- Executable code generation for evaluation
- JSON output for transformation pipeline

**Phase D: Build Tool Integration**
- plugin-babel implementation using builder
- Code transformation with Babel AST
- Zero-runtime replacement of gql calls
- Top-level query registration generation
- E2E tests with example applications

**Phase E: CLI & Developer Experience**
- CLI package with codegen integration
- `soda-gql generate` command
- Configuration file support
- Error handling with neverthrow
- Validation with zod v4

**Ordering Strategy**:
- TDD order: Tests MUST be written first (RED phase mandatory)
- Sequential phases: A→B→C→D→E (dependencies between phases)
- Within phases: Parallel tasks marked with [P] for independent files
- Contract tests before integration tests before unit tests

**Key Implementation Constraints**:
- No any/unknown without Generic type parameters
- No class-based state management
- Pure functions for testability
- neverthrow for error handling (no fromPromise)
- zod v4 for external data validation
- import only (no require) in tests

**Estimated Output**: 50-60 numbered, ordered tasks in tasks.md
- Phase A: ~15 tasks (runtime foundation)
- Phase B: ~10 tasks (code generation)
- Phase C: ~12 tasks (static analysis)
- Phase D: ~10 tasks (build integration)
- Phase E: ~8 tasks (CLI & polish)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 5 packages | Clear separation of concerns: runtime, codegen, build, plugin, CLI | Combining would mix runtime/build-time code, violate single responsibility |
| Complex dependency injection | Type safety requires injecting schema types into utilities | Direct coupling would prevent testing and reusability |


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
- [x] Initial Constitution Check: PASS (with documented deviations)
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*