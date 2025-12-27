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
- Fragments: Type-safe GraphQL field selections with transforms
- Operations: GraphQL query/mutation/subscription definitions with field selections
- Zero Runtime: All transformations at build time

**API Pattern**:
```typescript
// Operation with field selections
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    { name: "GetUser", variables: [$var("userId").scalar("ID:!")] },
    ({ f, $ }) => [
      f.user({ id: $.userId })(({ f }) => [f.id(), f.name(), f.email()]),
    ],
  ),
);

// Fragment definition
export const userFragment = gql.default(({ fragment }) =>
  fragment.User({}, ({ f }) => [f.id(), f.name()]),
);
// Embed in operations: userFragment.embed()
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

**Colocated Test Structure**:
- Tests are colocated within each package: `packages/{package}/test/`
- Shared test utilities: `@soda-gql/common/test`
- Package-specific fixtures: `packages/{package}/test/fixtures/`
- Package-specific schemas: `packages/{package}/test/schemas/`

**Fixture-Based Testing**:
- Store test code as `.ts` fixture files, not inline strings
- Place fixtures in `test/fixtures/` within each package
- Fixture files are type-checked by package's `tsconfig.editor.json`
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
- Unit tests: `packages/{package}/test/**/*.test.ts`
- Integration tests: `packages/{package}/test/**/*.test.ts`
- Fixtures: `packages/{package}/test/fixtures/**/*.ts`
- Shared utilities: `@soda-gql/common/test`

**Example Structure**:
```typescript
// Bad: Inline string test code
const source = `import { gql } from "@/graphql-system"; export const model = gql.default(...)`;
const result = analyze(source);

// Good: Fixture-based test code
import { loadFixture } from "@soda-gql/common/test";
const { filePath, source } = loadFixture("model-definition");
const result = analyze({ filePath, source });
```

### Pull Request Guidelines

**README Updates**:
- When creating PRs that change public APIs or add features, update relevant README files
- Main README.md for user-facing changes
- Package READMEs for package-specific changes
- Keep documentation in sync with implementation
- Update examples and code snippets when APIs change
