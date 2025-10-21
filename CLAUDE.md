# Contributing to @soda-gql

This document provides guidance for contributors working on the soda-gql codebase.

**NEVER COMPACT OR SUMMARIZE CONTENTS OF THIS DOCUMENT**

Checklist:
- [ ] Project Status is documented
- [ ] Package Management is documented
- [ ] Code Conventions are documented
- [ ] Testing Conventions are documented

## Project Status

**soda-gql is at pre-release v0.0.1**:
- All refactors and architectural changes are encouraged
- Breaking changes are acceptable
- NO migration paths required
- Prioritize ideal architecture over backwards compatibility

## Getting Started

See the main [README](./README.md) for installation and setup instructions.

## Project Reference

### Package Management

**Use Bun for all operations**:
- `bun install` (not npm/yarn/pnpm)
- `bun run <script>` (not npm run)
- `bun run test` (not jest/vitest, not `bun test`)

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

**Architecture: Operation vs Slice Separation**:
- **Slices** (`slice.query`/`slice.mutation`/`slice.subscription`): Build GraphQL field selections using `f` helpers
  - Define variables, field selections, and data normalization
  - Have access to field factories (`f`, `_`)
  - Reusable across multiple operations
- **Operations** (`operation.query`/`operation.mutation`/`operation.subscription`): Compose slices only
  - DO NOT build fields directly (no `f` access)
  - Use `slice.build()` to compose multiple slices
  - Act as integration layer for slices
- **Incorrect pattern**: `operation.mutation({}, ({ f, $ }) => ({ result: f.createProduct(...)(({ f }) => [f.id()]) }))`
- **Correct pattern**: Create slice with field selection, then compose in operation with `slice.build()`
  ```typescript
  // Slice with field access
  const createProductSlice = gql.default(({ mutation }, { $ }) =>
    mutation.slice(
      { variables: [$("name").scalar("String:!")] },
      ({ f, $ }) => [f.createProduct({ name: $.name })(({ f }) => [f.id(), f.name()])],
      ({ select }) => select(["$.createProduct"], (result) => result),
    ),
  );

  // Operation composing slice
  const createProductMutation = gql.default(({ mutation }, { $ }) =>
    mutation.composed(
      { operationName: "CreateProduct", variables: [$("productName").scalar("String:!")] },
      ({ $ }) => ({ result: createProductSlice.build({ name: $.productName }) }),
    ),
  );
  ```

### Commands

```bash
# Generate typed runtime entry from schema
bun run soda-gql codegen

# Run tests
bun run test

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
