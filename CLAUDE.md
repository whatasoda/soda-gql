# Contributing to @soda-gql

This document provides guidance for contributors working on the soda-gql codebase.

**NEVER COMPACT OR SUMMARIZE CONTENTS OF THIS DOCUMENT**

Checklist:
- [ ] Project Status is documented
- [ ] Package Management is documented
- [ ] Code Conventions are documented
- [ ] Testing Conventions are documented

## Project Status

**soda-gql is at pre-release v0.2.0**:
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

**API Pattern**: See `packages/core/test/` for usage examples

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

### Developer Documentation

| Document | When to Reference |
|----------|------------------|
| [Project Constitution](./memory/constitution.md) | Core principles, governance, and technical constraints |
| [Code Conventions](./memory/code-conventions.md) | Detailed coding standards with examples |
| [Builder Flow](./docs/guides/builder-flow.md) | Understanding builder processing flow |
| [Monorepo Infrastructure](./docs/guides/monorepo-infrastructure.md) | Package structure, build system, testing infrastructure |
| [Performance Profiling](./docs/guides/performance-profiling.md) | Performance measurement and optimization |
| [Performance Reference](./docs/reference/perf-measures.md) | Benchmark command quick reference |

### Documentation Standards

**Language**: ALL documentation in English, American spelling
- Use "color" not "colour", "organize" not "organise"
- Code comments, commits, README in English
- No mixed languages

### Code Conventions

See [Code Conventions](./memory/code-conventions.md) for detailed standards with examples.

**Key Points**:
- NO `any`/`unknown` - use generic constraints
- neverthrow for errors (`ok()`, `err()` only, NO `fromPromise`)
- NO classes for state - pure functions preferred
- TDD mandatory - no mocks, use real dependencies

### Testing Conventions

See [Code Conventions](./memory/code-conventions.md) for TDD methodology details.

**Structure**:
- Tests colocated: `packages/{package}/test/`
- Fixtures: `packages/{package}/test/fixtures/*.ts`
- Shared utilities: `@soda-gql/common/test`

**Approach**:
- Fixture-based testing (`.ts` files, not inline strings)
- Test behavior, not implementation details
- Use `__resetRuntimeRegistry()` to clear state between tests

**Example**: See `packages/builder/test/` for patterns

### Pull Request Guidelines

**README Updates**:
- When creating PRs that change public APIs or add features, update relevant README files
- Main README.md for user-facing changes
- Package READMEs for package-specific changes
- Keep documentation in sync with implementation
- Update examples and code snippets when APIs change
