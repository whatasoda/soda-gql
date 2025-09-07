---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Project: Zero-runtime GraphQL Query Generation

This project implements a zero-runtime GraphQL query generation system similar to PandaCSS's CSS-in-JS approach.

### Tech Stack

- **Language**: TypeScript 5.x with Bun runtime
- **Build**: Bun plugin system for static analysis and transformation
- **Error Handling**: neverthrow for type-safe Results
- **Validation**: Zod for runtime validation
- **Testing**: Bun test with TDD (t_wada methodology)

### Key Concepts

- **Remote Models**: Type-safe GraphQL fragments with transforms
- **Query Slices**: Domain-specific query definitions
- **Page Queries**: Composed queries from multiple slices
- **Zero Runtime**: All transformations at build time

### Commands

```bash
# Run tests
bun test

# Run quality checks (linting + type check)
bun quality

# Type check only
bun typecheck
```

## Universal Code Conventions

### Type Safety

- **NO any/unknown**: Never use `any` or `unknown` directly
  - Use Generic type parameters with constraints instead
  - Example: `<T extends BaseType>` not `any`
  - Cast to any/unknown only within Generic constraints
- **Acceptable any usage** (requires suppression comment):
  - Generic type parameter defaults: `<T = any>` with `// biome-ignore lint/suspicious/noExplicitAny: generic default`
  - Type utilities that must handle any type: `// biome-ignore lint/suspicious/noExplicitAny: type utility`
  - Test assertions with complex types: `// biome-ignore lint/suspicious/noExplicitAny: test assertion`
  - Temporary migration code (must have TODO): `// biome-ignore lint/suspicious/noExplicitAny: TODO: add proper types`
- **External Data Validation**: Always validate with zod v4
  - JSON files, API responses, user input
  - Never trust external data types
  - Example: `z.object({ ... }).parse(data)`

### Error Handling

- **Use neverthrow**: Type-safe error handling without exceptions
  - Use `ok()` and `err()` functions only
  - NO `fromPromise` (loses type information)
  - Use discriminated unions for complex flows
  - Example: `Result<SuccessType, ErrorType>`
- **Never throw**: Return Result types instead
  - Exceptions only for truly exceptional cases
  - All expected errors must be Result types

### Code Organization

- **NO Classes for State**: Classes forbidden for state management
  - OK for: DTOs, Error classes, pure method collections
  - Use dependency injection for state
  - Keep state scope minimal with closures
- **Pure Functions**: Extract pure logic for testability
  - Side effects at boundaries only
  - Dependency injection over global state
- **Optimize Dependencies**: Both file and function level
  - Minimize coupling between modules
  - Use explicit imports, never circular
- **NEVER import from /specs/**: Specs are documentation only
  - Don't import contracts or types from specs directory
  - Copy needed types to packages instead
  - specs/*/contracts/ files are reference documentation

### Testing

- **TDD Mandatory**: t_wada methodology
  - Write test first (RED phase)
  - Make it pass (GREEN phase)
  - Refactor (REFACTOR phase)
  - Commit tests before implementation
- **No Mocks**: Use real dependencies
  - Real databases, actual file systems
  - Integration issues caught early
- **Import Only**: Use `import`, never `require`
  - Preserves type information
  - Better tree-shaking

### Bun Specific

- Use Bun's built-in APIs over Node.js equivalents
- `Bun.file()` over `fs.readFile()`
- `bun:test` for testing
- `bun:sqlite` for SQLite

## Documentation

### Architecture Decision Records (ADRs)

Significant architectural decisions are documented in `docs/decisions/`.

**When to write an ADR**:
- Multiple viable technical approaches exist
- Decision would be hard to reverse
- Deviating from established patterns

**How to write**: 
1. Copy `docs/decisions/adr-template.md`
2. Fill out Context, Decision, and Consequences
3. Reference in code: `// See ADR-001`

See [ADR-000](docs/decisions/000-adr-process.md) for the full process.

### Recent Decisions

- [ADR-001](docs/decisions/001-relation-field-selection.md): Explicit relations with `__relation__`
- [ADR-002](docs/decisions/002-type-brand-safety.md): Runtime-safe type brands