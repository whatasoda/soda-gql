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
# Generate base types from schema
bun run @soda-gql/core generate

# Run tests
bun test

# Build with transformations
bun run build

# Type check
bun run typecheck
```

## Universal Code Conventions

### Type Safety

- **NO any/unknown**: Never use `any` or `unknown` directly
  - Use Generic type parameters with constraints instead
  - Example: `<T extends BaseType>` not `any`
  - Cast to any/unknown only within Generic constraints
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

### Recent Changes

- 001-zero-runtime-gql-in-js: Zero-runtime GraphQL query generation system
  - Phase A: Runtime implementation with createGql and utilities
  - Phase B: Code generation from GraphQL schema
  - Phase C: Static analysis and builder for document generation
  - Phase D: Build tool plugins (Babel, Bun)
  - Phase E: CLI and developer experience

## Documentation Guidelines

### Architecture Decision Records (ADRs)

All significant architectural decisions should be documented in `docs/decisions/`.

**When to write an ADR**:
- Choosing between multiple viable technical approaches
- Making decisions that will be hard to reverse
- Deviating from established patterns
- Adopting new technologies or patterns

**Process**:
1. Copy `docs/decisions/adr-template.md` to `docs/decisions/XXX-brief-name.md`
2. Fill out all sections, especially Context and Consequences
3. Include code examples where helpful
4. Reference the ADR in relevant code with comments like `// See ADR-001`
5. Link to the ADR in PR descriptions when implementing

**Format**: We use Michael Nygard's lightweight ADR format with Status, Context, Decision, and Consequences sections.

## Architectural Decisions

### Type Brand Properties (2024-01)

**Decision**: Use function-returning brand properties instead of direct type references
- Brand properties (`_type`, `_data`, etc.) return functions: `() => T`
- Prevents runtime errors when properties are accessed
- Maintains full type safety at compile time
- Example: `readonly _type: () => TType` instead of `readonly _type: TType`

**Rationale**: Direct type references would throw at runtime if accessed. Function returns provide a safer undefined behavior while preserving TypeScript's type inference.

### Explicit Relations with __relation__ (2024-01)

**Decision**: Use `__relation__` property to explicitly define GraphQL relations
- Relations must be defined in a special `__relation__` property
- Regular nested objects (non-relations) can only be selected with boolean
- Relations support nested field selection
- Arrays are automatically unwrapped for selection

**Example**:
```typescript
type User = {
  id: string;
  profile: { bio: string };        // Regular object
  __relation__: {
    posts: Post[];                 // Relation (array)
    company: Company;              // Relation (single)
  };
};

// Selection:
const fields: FieldSelection<User> = {
  id: true,
  profile: true,                   // Boolean only
  posts: {                         // Nested selection
    id: true,
    title: true,
  },
};
```

**Rationale**: 
- Object type detection alone is insufficient for determining relations
- Explicit marking provides precise control
- Code generation can easily produce `__relation__` structure
- Supports nested `__relation__` for complex schemas
