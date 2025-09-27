# 🚨 CRITICAL: Agent Task Delegation (MUST FOLLOW)

## ⚠️ MANDATORY Task Division Strategy

**THIS SECTION MUST BE FOLLOWED WITHOUT EXCEPTION**. When working on ANY development task, you MUST divide responsibilities between agents as follows:

### **Codex MUST Handle**:
- **ALL code analysis** - Deep understanding of existing codebase patterns
- **ALL implementation details** - Technical decisions and approach determination
- **ALL result evaluation** - Quality assessment and validation

### **Claude MUST Handle**:
- **Task progression** - Managing workflow and task coordination
- **Code implementation** - Executing the actual code changes
- **Integration** - Ensuring smooth component integration

### **MANDATORY Communication Protocol**:
**ALL inter-agent coordination MUST be conducted in ENGLISH**. No exceptions.

### **Required Workflow** (DO NOT SKIP ANY STEP):
1. Claude receives user request
2. Claude **MUST** delegate analysis to Codex (in English)
3. Codex analyzes and returns implementation strategy
4. Claude executes implementation based on Codex's guidance
5. Codex **MUST** evaluate results
6. Claude adjusts implementation based on feedback

**FAILURE TO FOLLOW THIS DELEGATION WILL RESULT IN SUBOPTIMAL IMPLEMENTATIONS**

---

## Use Bun instead of Node.js, npm, pnpm, or vite.

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
# Generate typed runtime entry from schema
bun run soda-gql codegen --schema ./schema.graphql --out packages/graphql-system/src/index.ts

# Produce runtime GraphQL documents during development
bun run soda-gql builder --mode runtime --entry ./src/pages/**/*.ts --out ./.cache/soda-gql/runtime.json

# Run tests
bun test

# Run quality checks (linting + type check)
bun quality

# Type check only
bun typecheck
```

## Documentation Standards

### Language Requirements

- **ALL documentation MUST be in English**: Code comments, commit messages, README files, and inline documentation
- **No mixed languages**: Never mix English and other languages in the same document
- **Consistency is mandatory**: Once started in English, continue in English throughout

### Spelling Standards

- **Use American English spelling**: Always use American English spelling conventions, not British English
- **Examples of correct spelling**:
  - Use "color" not "colour"
  - Use "organize" not "organise"
  - Use "center" not "centre"
  - Use "analyze" not "analyse"
  - Use "behavior" not "behaviour"
- **Apply consistently**: All code, comments, and documentation must follow American English spelling

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

## Tool Utilities

### @soda-gql/tool-utils Package

A utility collection exclusively for the toolchain. **NEVER use in core and runtime packages**.

#### Available Utilities

- **[unwrap-nullish](packages/tool-utils/docs/unwrap-nullish.md)**: A utility to safely unwrap values that are nullable in the type system but will never be null in the implementation

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

## Recent Changes
- 2025-09-20 (001-zero-runtime-gql-in-js): Document staged runtime → zero-runtime plan, added codegen/builder commands.
