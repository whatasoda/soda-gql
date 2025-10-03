# Contributing to @soda-gql

This document provides guidance for contributors working on the soda-gql codebase.

**NEVER COMPACT OR SUMMARIZE CONTENTS OF THIS DOCUMENT**

Checklist:
- [ ] Project Status is documented
- [ ] AI-Assisted Development is documented
- [ ] Package Management is documented
- [ ] Code Conventions are documented
- [ ] Testing Conventions are documented

## Project Status

**soda-gql is at pre-release v0.1.0**:
- All refactors and architectural changes are encouraged
- Breaking changes are acceptable
- NO migration paths required
- Prioritize ideal architecture over backwards compatibility

## Getting Started

See the main [README](./README.md) for installation and setup instructions.

## AI-Assisted Development

This project uses Codex MCP for complex code analysis, implementation planning, and follow-ups.

**Note**: Codex provides read-only analysis and planning. All file modifications and command executions are performed by Claude following Codex's strategy.

**When to use Codex**:
- Writing new code or modifying existing implementations
- Debugging and fixing errors
- Refactoring and performance optimization
- Architecture decisions and API design
- Complex code analysis requiring deep codebase understanding
- Follow-ups after all cases above are complete

**How to use Codex**:
1. Use the `mcp__codex__codex` tool with your implementation request
2. Codex will analyze the codebase and provide a detailed strategy
3. Implement following Codex's guidance
4. For follow-ups, use `mcp__codex__codex-reply` with the conversationId (UUID)

### Pre-Action Checkpoint (Execute Before Every Code Action)

**P0 - MUST NEVER BREAK**:
- [ ] Am I (Claude) about to edit code? → Codex plan required
- [ ] Has Codex been consulted for this code task? → If NO, STOP
- [ ] Is Codex's conversationId saved for follow-ups? → UUID format required

**P1 - STRONGLY REQUIRED**:
- [ ] Am I following Codex's strategy exactly? → If NO, re-consult
- [ ] Are there implementation issues? → Use `mcp__codex__codex-reply`
- [ ] Is the task complete? → Verify against Codex's success criteria

**P2 - RECOMMENDED**:
- [ ] Are tests/checks run as Codex specified?
- [ ] Is user informed of progress?
- [ ] Are edge cases from Codex's warnings handled?

### Canonical Flow Diagram

```
User Request
    ↓
Claude receives → Translates to English if needed
    ↓
IMMEDIATE: Call mcp__codex__codex (NO EXCEPTIONS)
    ↓
Codex analyzes (READ-ONLY) → Returns conversationId (UUID)
    ↓
Claude saves conversationId (UUID) for follow-ups
    ↓
Claude implements EXACTLY as specified
    ↓
Issues arise? → Call mcp__codex__codex-reply WITH conversationId
    ↓ ↕️
Codex refines plan (READ-ONLY) ← Claude reports execution results
    ↓
Repeat until complete → User receives result
```

### Communication Requirements

**Language Protocol**:
- **ALL communication with Codex MUST be in English**
- Translate user requests to English before sending to Codex
- File paths, error messages, and context must be in English

**Handoff Protocol**:
- **Claude → Codex**: Include full user context, file paths, error messages
- **Codex → Claude**: Provide implementation steps, patterns, warnings
- **Claude → Codex (follow-up)**: Include execution results, errors encountered
- **Codex → Claude (refinement)**: Adjusted strategy based on feedback

### Task Classification

**✅ REQUIRES CODEX (Mandatory)**:
- Writing new code
- Modifying existing code
- Debugging and fixing errors
- Refactoring
- Performance optimization
- Architecture decisions
- API design
- Database schema changes
- Test implementation
- Code reviews

**⚪ DOES NOT REQUIRE CODEX (Claude handles alone)**:
- Running existing commands (`bun test`, `bun install`)
- Reading files for information only
- Git operations (`git status`, `git log`, `git diff`)
- File system operations (`ls`, `mkdir`, `mv`)
- Documentation queries (non-code)
- Project setup verification
- Status reporting
- User clarification questions

**🤔 EDGE CASES**:
- **Configuration file changes**: Use Codex if it affects application behavior
- **README updates**: Use Codex if documenting code architecture
- **Package.json scripts**: Use Codex if adding new build/test scripts
- **Environment variables**: Use Codex if adding new application config

---

## Project Reference

### Package Management

**Use Bun for all operations**:
- `bun install` (not npm/yarn/pnpm)
- `bun run <script>` (not npm run)
- `bun test` (not jest/vitest)

**Use Node.js APIs for implementation**:
- Node.js `fs/promises` for file operations
- Node.js `path` for path operations
- Keep code compatible with standard Node.js runtime

### Project Overview

**Zero-runtime GraphQL Query Generation** (similar to PandaCSS approach)

**Tech Stack**:
- TypeScript 5.x with Bun runtime
- Bun plugin system for transformations
- neverthrow for error handling
- Zod v4 for validation
- Bun test with TDD (t_wada methodology)

**Key Concepts**:
- Models: Type-safe GraphQL fragments with transforms
- Operation Slices: Domain-specific query/mutation/subscription definitions
- Operations: Composed GraphQL operations from multiple slices
- Zero Runtime: All transformations at build time

### Commands

```bash
# Generate typed runtime entry from schema
bun run soda-gql codegen --schema ./schema.graphql --out packages/graphql-system/src/index.ts

# Produce runtime GraphQL documents
bun run soda-gql builder --mode runtime --entry ./src/pages/**/*.ts --out ./.cache/soda-gql/runtime.json

# Run tests
bun test

# Quality checks (linting + type check)
bun quality

# Type check only
bun typecheck
```

### Documentation Standards

**Language**: ALL documentation in English, American spelling
- Use "color" not "colour", "organize" not "organise"
- Code comments, commits, README in English
- No mixed languages

### Code Conventions

**Type Safety**:
- NO `any`/`unknown` directly - use generic constraints
- Acceptable `any` usage requires suppression comment
- Validate external data with Zod v4

**Error Handling**:
- Use neverthrow for type-safe errors
- Use `ok()` and `err()` functions only
- NO `fromPromise` - loses type information
- Never throw - return Result types

**Code Organization**:
- NO classes for state management
- Pure functions for testability
- Minimize dependencies and coupling

**Testing**:
- TDD mandatory (t_wada: RED → GREEN → REFACTOR)
- No mocks - use real dependencies
- Use `import`, never `require`

### Testing Conventions

**Fixture-Based Testing**:
- Store test code as `.ts` fixture files, not inline strings
- Place fixtures in `tests/fixtures/` with descriptive subdirectories
- Fixture files are type-checked by `tests/tsconfig.json`
- Use `@ts-expect-error` for intentionally invalid test cases
- Benefits: Type safety, editor support, refactoring tools work

**Behavioral Testing**:
- Test **behavior** (execution results), not **implementation details** (output format)
- For transform tests: Execute transformed code and verify runtime behavior
- Don't assert on exact transformation output (brittle to formatting changes)
- Example: Instead of `expect(code).toContain("gqlRuntime.operation")`, execute the code and verify the operation was registered

**Integration Test Utilities**:
- Use `__resetRuntimeRegistry()` from `@soda-gql/core/runtime` to clear operation registry between tests
- Use spies/wrappers to track registrations without mocking
- Transpile TypeScript test output with `new Bun.Transpiler()` before execution
- Dynamic imports with cache-busting: `import(\`file://\${path}?t=\${Date.now()}\`)`

**Test Organization**:
- Unit tests: `tests/unit/**/*.test.ts` - Test individual functions/modules
- Integration tests: `tests/integration/**/*.test.ts` - Test full workflows with real dependencies
- Fixtures: `tests/fixtures/**/*.ts` - Reusable test code samples

**Example Structure**:
```typescript
// Bad: Inline string test code
const source = `import { gql } from "@/graphql-system"; export const model = gql.default(...)`;
const result = analyze(source);

// Good: Fixture-based test code
const { filePath, source } = loadFixture("model-definition");
const result = analyze({ filePath, source });
```

### Tool Utilities

**@soda-gql/tool-utils**: Toolchain utilities only
- **NEVER use in core/runtime packages**
- [unwrap-nullish](packages/tool-utils/docs/unwrap-nullish.md): Safely unwrap nullable values

### Architecture Decision Records

**Location**: `docs/decisions/`

**When to write**:
- Multiple viable approaches exist
- Decision is hard to reverse
- Deviating from established patterns

**Process**: See [ADR-000](docs/decisions/000-adr-process.md)

### Recent Changes

- 2025-09-20 (ADR-001): Documented zero-runtime plan, added codegen/builder commands
