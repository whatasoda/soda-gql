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

Develop a zero-runtime GraphQL query generation system similar to PandaCSS's CSS-in-JS approach. The system allows developers to write GraphQL queries in TypeScript with full type safety, which are then statically analyzed and transformed at build time into optimized GraphQL documents.

### Core Innovation & Background

**The Problem**: Traditional GraphQL tooling requires constant code regeneration, runtime query parsing, and lacks advanced features like parameterized fragments. Developers face a choice between type safety (with heavy codegen) or flexibility (without types).

**Our Solution**: Apply PandaCSS's zero-runtime pattern to GraphQL:
1. **Development Time**: Full TypeScript inference without code generation loops
2. **Build Time**: Static analysis extracts and optimizes queries
3. **Runtime**: Zero overhead - pre-generated documents only

### Implementation Philosophy

The implementation deliberately follows a **runtime-first, zero-runtime later** approach:

**Why Runtime First**:
- **Faster Development**: Test the core abstractions without build tool complexity
- **Better Testing**: Library users can test without configuring plugins
- **Proven Pattern**: PandaCSS followed this evolution successfully
- **Cost Efficiency**: Runtime implementation becomes the execution engine for static analysis - just extract code and run it to generate documents

**Why Generated Imports** (`@/graphql-system`):
- **Schema Integration**: Embed schema types naturally without manual imports
- **Developer Experience**: Single import source, full autocomplete
- **Flexibility**: Regenerate only when schema changes, not on every query edit
- **Precedent**: PandaCSS's styled-system pattern is familiar to developers

### Architectural Trade-offs

**5 Packages vs Monolithic**:
- **Chosen**: Separate packages for clear boundaries
- **Trade-off**: More complex project structure
- **Benefit**: Runtime code never includes build-time dependencies
- **Justification**: Users only install what they need (runtime for apps, plugins for build)

**Dependency Injection vs Direct Coupling**:
- **Chosen**: Factory pattern with type injection
- **Trade-off**: More abstract API surface
- **Benefit**: Complete type safety without circular dependencies
- **Justification**: Enables testing and reuse across different schemas

## Technical Context
**Language/Version**: TypeScript 5.x with Bun runtime  
**Primary Dependencies**: neverthrow (error handling), zod v4 (validation), Babel/AST parsers  
**Storage**: JSON files for generated GraphQL documents, file system for generated code  
**Testing**: Bun test with TDD (t_wada methodology)  
**Target Platform**: Node.js/Bun runtime, browser environments via build tools
**Project Type**: Monorepo with multiple packages (core, codegen, builder, plugins, cli)  
**Performance Goals**: Zero runtime overhead, instant type feedback during development  
**Constraints**: Must handle up to 32 slices per Page Query (warning at 16+), single schema version support  
**Scale/Scope**: Support Feature-Sliced Design architecture, multiple build tools (Babel minimum)

**Development Conventions**:
- **TypeScript Config**: Monorepo best practices with tsconfig.base.json and per-package configs
- **Import Style**: No file extensions in imports (`import { x } from './file'` not `'./file.ts'`)
- **Build Strategy**: Direct TS references initially, build config deferred until publishing
- **Workspace**: Bun workspaces with workspace protocol for internal dependencies
- **CRITICAL**: NEVER import from `/specs/` directory - specs are documentation only, not implementation

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

### Package Architecture Rationale

The monorepo structure was chosen to facilitate coordinated development while maintaining clear separation:

```
packages/
├── core/           # Runtime GraphQL utilities
│   # Pure runtime code, zero build dependencies
│   # Can be used directly for runtime-only scenarios
│   # Exports createGql factory and all utilities
│
├── codegen/        # Schema code generation  
│   # Parses GraphQL schema files
│   # Generates TypeScript types and graphql-system
│   # Only needed during development, not in production
│
├── builder/        # Static analysis & doc generation
│   # Shared logic for all build tool plugins
│   # AST analysis and dependency resolution
│   # Generates executable code for document creation
│
├── plugin-babel/   # Babel transformation plugin
│   # Reference implementation using builder
│   # Transforms code to zero-runtime
│   # Supports all Babel-based tools (Next.js, CRA, etc.)
│
└── cli/            # Command-line interface
    # Developer tools and code generation
    # Wraps codegen with user-friendly commands
    # Configuration management

examples/
├── basic/          # Demonstrates core concepts
│   # RemoteModel, QuerySlice, PageQuery usage
│   # Both runtime and zero-runtime examples
│
└── advanced/       # Complex real-world patterns
    # Cross-module composition
    # Parameterized relationships
    # Performance optimizations

tests/
├── integration/    # Cross-package interaction tests
│   # Validates package boundaries
│   # End-to-end transformation pipeline
│
└── e2e/            # Full application scenarios
    # Real GraphQL servers
    # Production-like builds
    # Performance benchmarks
```

**Why This Structure**:
1. **Clear Responsibilities**: Each package has single, well-defined purpose
2. **Independent Versioning**: Can release patches to plugins without touching core
3. **Optimal Bundle Size**: Apps only include runtime code, build tools stay in devDependencies
4. **Parallel Development**: Teams can work on different packages simultaneously
5. **Testing Isolation**: Each package can be tested independently

### TypeScript Configuration Strategy

**Monorepo TypeScript Best Practices**:

```
# Root configuration files
/
├── tsconfig.json          # Root config for IDE support
├── tsconfig.base.json     # Shared base configuration
├── package.json           # Workspace configuration
│
# Per-package configuration
packages/
├── core/
│   └── tsconfig.json      # Extends ../../tsconfig.base.json
├── codegen/
│   └── tsconfig.json      # Extends ../../tsconfig.base.json
├── builder/
│   └── tsconfig.json      # Extends ../../tsconfig.base.json
├── plugin-babel/
│   └── tsconfig.json      # Extends ../../tsconfig.base.json
└── cli/
    └── tsconfig.json      # Extends ../../tsconfig.base.json
```

**Configuration Details**:

1. **tsconfig.base.json**: Shared compiler options
   - `strict: true` for maximum type safety
   - `module: "NodeNext"` for modern module resolution
   - `moduleResolution: "NodeNext"` for package.json exports
   - `esModuleInterop: true` for compatibility
   - No `paths` aliases - use workspace protocol

2. **Root tsconfig.json**: IDE and tooling support
   - References all packages for project-wide navigation
   - Composite project setup for incremental builds
   - Solution-style configuration

3. **Package tsconfig.json**: Package-specific settings
   - Extends base configuration
   - Sets `outDir` and `rootDir` appropriately
   - Defines package-specific `include` patterns
   - References dependent packages via `references`

**Import Convention**:
- **No file extensions in imports**: TypeScript handles resolution
- Example: `import { createGql } from './create-gql'` not `'./create-gql.ts'`
- Rationale: Allows flexibility in build output format

**⚠️ CRITICAL Import Restriction**:
- **NEVER import from `/specs/` directory in implementation code**
- Specs contain contracts and documentation, NOT implementation
- Files in `/specs/001-*/contracts/` are for reference only
- Copy type definitions to packages if needed, don't import directly
- Example of what NOT to do:
  ```typescript
  // ❌ FORBIDDEN - Never do this
  import { RemoteModel } from '../../specs/001-zero-runtime-gql-in-js/contracts/runtime-api';
  
  // ✅ CORRECT - Define in package
  // packages/core/src/types/remote-model.ts
  export interface RemoteModel<T> { ... }
  ```

### Build Strategy

**Development-First Approach**:

1. **Initial Phase: Direct TS References**
   - Packages reference TypeScript files directly
   - No build step required for development
   - Fast iteration with Bun's native TS support
   - Example: `packages/plugin-babel` imports from `packages/builder/src/index.ts`

2. **Testing Phase: Runtime Execution**
   - Tests run against TypeScript source directly
   - Bun test handles TS transparently
   - No compilation needed for test execution

3. **Final Phase: Build Configuration** (Deferred)
   - Add build configuration only when publishing
   - Each package gets appropriate build setup:
     - `core`: ESM + CJS dual package
     - `codegen`: CLI-focused build
     - `builder`: Library build
     - `plugin-babel`: Babel plugin format
     - `cli`: Executable with bundled dependencies

**Why Defer Build Configuration**:
- Faster initial development without build complexity
- Focus on functionality over packaging
- Bun's native TS support eliminates build need during development
- Build configuration can be optimized based on actual usage patterns

**Package.json Workspace Setup**:
```json
{
  "workspaces": [
    "packages/*",
    "examples/*"
  ]
}
```

Each package uses workspace protocol for internal dependencies:
```json
{
  "dependencies": {
    "@soda-gql/core": "workspace:*"
  }
}
```

## Phase 0: Outline & Research

### Background & Rationale

The research phase focused on understanding how to achieve zero-runtime GraphQL generation similar to PandaCSS's approach. Key challenges addressed:

1. **Runtime-First Strategy**: Starting with runtime implementation provides immediate value and simplifies testing. This approach mirrors how PandaCSS evolved - proving the concept works before optimizing for zero-runtime.

2. **Type Safety Without Code Generation**: Traditional GraphQL tools require constant code regeneration. Our approach uses TypeScript's type system directly, similar to how PandaCSS uses CSS types.

3. **Build Tool Agnostic Design**: Learning from PandaCSS's plugin architecture, we design for multiple build tools from the start.

### Research Execution

1. **Technology Stack Selection**:
   - **TypeScript + Bun**: Chosen for fast iteration and native TypeScript support
   - **neverthrow**: Addresses the requirement for type-safe error handling without exceptions
   - **zod v4**: Ensures external data (JSON files, schemas) are validated at boundaries
   - **Background**: These choices support the "no any/unknown" requirement while maintaining developer ergonomics

2. **Architectural Pattern Research**:
   - **Static Analysis Approach**: Studied PandaCSS's AST transformation pipeline
   - **Dependency Resolution**: Designed "{file}::{export}::{property}" identifier system for unique element identification
   - **Registration Pattern**: Module-level registration prevents React re-render issues
   - **Background**: Each pattern solves specific zero-runtime challenges identified in requirements

3. **Implementation Phasing**:
   - **Why Runtime First**: Enables immediate testing, library usage in test code without plugins
   - **Generated System Pattern**: Mimics PandaCSS's styled-system for familiar DX
   - **Progressive Enhancement**: Each phase builds on previous, allowing partial adoption

**Output**: research.md with complete technology decisions and architectural patterns

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### Design Philosophy & Background

The design phase translates PandaCSS patterns to GraphQL domain while addressing unique challenges:

1. **Entity Design Rationale**:
   - **RemoteModel**: Core abstraction replacing GraphQL fragments
     - Why: Fragments lack parameterization and transform capabilities
     - Design: Includes mandatory transform function for data normalization
   - **QuerySlice/MutationSlice**: Domain isolation pattern from Feature-Sliced Design
     - Why: Enables cross-module composition without coupling
     - Design: Each slice is self-contained with own arguments and transforms
   - **PageQuery**: Aggregation point for multiple slices
     - Why: Single GraphQL request despite multiple contributing modules
     - Design: Automatic deduplication and argument mapping

2. **Contract Design Decisions**:
   - **runtime-api.ts**: Public developer-facing API
     - Mirrors PandaCSS's css/styled functions
     - Type-safe with full inference from schema
   - **plugin-api.ts**: Build tool integration interface
     - Standardized across Babel, Bun, Vite, etc.
     - Clear separation of analysis, generation, transformation phases

3. **Type System Architecture**:
   - **Generated Types**: All schema types in graphql-system directory
     - Why: Single source of truth, no manual type definitions
   - **Phantom Types**: Type brands for compile-time safety
     - Why: Prevent mixing incompatible types without runtime cost
   - **Parameter Injection**: Generic type parameters for relationships
     - Why: Solve N+1 problem at type level

4. **Testing Strategy Background**:
   - **Contract Tests First**: Validate API shape before implementation
   - **TDD with t_wada**: Proven methodology for complex systems
   - **No Mocks Policy**: Real GraphQL schemas, actual file system
     - Why: Catches integration issues early

5. **Developer Experience Considerations**:
   - **Quickstart Guide**: Practical examples over theory
   - **Progressive Disclosure**: Simple cases first, advanced later
   - **Error Messages**: Detailed context with source locations

**Output**: data-model.md, /contracts/*, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Strategic Phasing Rationale

The implementation is deliberately structured in 5 phases (A→E) based on dependency relationships and risk mitigation:

**Task Generation Strategy**:

### Phase A: Runtime Implementation (Foundation)
**Why First**: Provides immediate value and enables testing without build tool complexity

**Background & Details**:
- **TypeScript-First Development**:
  - Direct TS file imports between packages (no build step)
  - Bun executes TypeScript natively during development
  - Import paths without extensions: `import { util } from './util'`
  - TypeScript project references for cross-package types
  
- **createGql Function**: Factory pattern that accepts generated schema types
  - Rationale: Enables type injection without circular dependencies
  - Returns object with all utilities (model, query, mutation methods)
  - Located in `packages/core/src/create-gql.ts`
  
- **Individual Utilities**: Each implemented as pure function with dependency injection
  - RemoteModel: Handles field selection and transform functions
  - QuerySlice: Encapsulates domain-specific queries
  - MutationSlice: Similar to QuerySlice for mutations
  - PageQuery: Combines multiple slices with deduplication
  - Each in separate file for clarity (e.g., `src/remote-model.ts`)
  
- **Type Injection Mechanism**: Generic constraints ensure type safety
  - Example: `createGql<TSchema>()` where TSchema extends GeneratedSchema
  - No `any` types except within Generic bounds
  
- **Testing Strategy**: TDD with real GraphQL schemas
  - Tests import TS files directly: `import { createGql } from '../src/create-gql'`
  - No mocks ensures integration issues caught early
  - Each utility tested in isolation then integration
  - Test files colocated: `src/__tests__/create-gql.test.ts`

- **Implementation Guidelines**:
  - **CRITICAL**: Never import from `/specs/` directory
  - Contracts in `/specs/001-*/contracts/` are reference only
  - Copy type definitions to `packages/core/src/types/`
  - Each package self-contained with its own type definitions
  - Example structure:
    ```
    packages/core/src/
    ├── types/
    │   ├── remote-model.ts    # Copied from spec, not imported
    │   ├── query-slice.ts     # Copied from spec, not imported
    │   └── index.ts           # Re-exports all types
    ├── create-gql.ts
    └── index.ts
    ```

### Phase B: Code Generation System
**Why Second**: Runtime implementation informs generation requirements

**Background & Details**:
- **Schema Parsing**: GraphQL AST to TypeScript types
  - Handles all GraphQL constructs (types, inputs, enums, scalars)
  - Generates discriminated unions for better type narrowing
- **graphql-system Directory**: Mimics PandaCSS's styled-system
  - Users import from generated code, not library directly
  - Contains all type definitions and configured gql instance
- **Template System**: Generates TypeScript with proper imports
  - Ensures tree-shaking works correctly
  - Maintains source maps for debugging

### Phase C: Static Analysis & Builder
**Why Third**: Builds on stable runtime and generation foundation

**Background & Details**:
- **AST Analysis**: TypeScript Compiler API for accurate extraction
  - Identifies all gql usage (model, query, mutation calls)
  - Preserves location information for error reporting
- **Dependency Resolution**: Unique identifier system
  - Format: "{absolute_path}::{export_name}::{property_path}"
  - Handles re-exports and barrel files correctly
  - Example: "/src/models/user.ts::default::userWithPosts"
- **Executable Code Generation**: Creates single evaluation script
  - All elements in `refs` object with lazy evaluation
  - Dependencies wrapped in arrow functions to prevent order issues
  - GraphQL documents in `docs` object with unique names
- **JSON Output**: Structured data for transformation phase
  - Contains mappings from original code to generated documents
  - Includes transform functions as serialized strings

### Phase D: Build Tool Integration
**Why Fourth**: Applies proven patterns to actual build pipelines

**Background & Details**:
- **plugin-babel**: Reference implementation using builder
  - Hooks into Babel's visitor pattern
  - Replaces gql calls with generated documents
  - Moves query definitions to module top-level
- **Code Transformation Strategy**:
  - Runtime calls replaced with pre-generated documents
  - Transform functions preserved for runtime execution
  - React component optimization (hoisting outside render)
- **Performance Optimizations**:
  - Incremental compilation support
  - Caching of unchanged files
  - Parallel processing where possible

### Phase E: CLI & Developer Experience
**Why Last**: Polish and tooling after core functionality proven

**Background & Details**:
- **CLI Design**: Simple commands with sensible defaults
  - `soda-gql init`: Setup project with config
  - `soda-gql generate`: Generate graphql-system
  - `soda-gql check`: Validate without generation
- **Error Handling**: User-friendly messages with context
  - Shows exact location in source code
  - Suggests fixes for common issues
  - Never throws, uses Result types throughout
- **Configuration**: Minimal but extensible
  - Schema location and output directory
  - Plugin-specific options
  - Custom transform directories

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
| 5 packages instead of 3 | Clear separation between runtime/build-time/generation phases | Combining packages would: (1) Include build-time code in runtime bundles, (2) Make testing significantly harder, (3) Prevent independent versioning of critical components |
| Complex dependency injection pattern | Type safety requires injecting generated schema types into core utilities | Direct coupling alternative would: (1) Require regenerating core package for each schema change, (2) Make unit testing impossible without full schema, (3) Prevent library reuse across projects |
| Multiple configuration files | Each tool (Babel, Bun, CLI) has different config needs | Single config would: (1) Create huge config with tool-specific sections, (2) Require runtime config parsing in build tools, (3) Complicate schema validation per tool |
| Abstract factory pattern for createGql | Enables schema type injection while maintaining type safety | Simpler direct instantiation would: (1) Lose type inference, (2) Require manual type annotations everywhere, (3) Break when schema changes |


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