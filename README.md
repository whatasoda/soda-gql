# @soda-gql - Zero-runtime GraphQL Query Generation

A zero-runtime GraphQL query generation system that brings PandaCSS's approach to GraphQL. Write type-safe queries in TypeScript that are statically analyzed and transformed at build time into optimized GraphQL documents.

## Features

- 🔍 **Full Type Safety**: Complete TypeScript inference from schema to query results
- 🎯 **No Code Generation Loop**: Unlike traditional GraphQL codegen, no constant regeneration needed
- 🔧 **Transform Functions**: Built-in data normalization at the model level
- 📦 **Modular Architecture**: Compose queries from reusable models
- ⚡ **Instant Feedback**: Type errors appear immediately in your IDE

## Project Structure

```
packages/
├── core/           # Runtime GraphQL utilities
├── codegen/        # Schema code generation
├── builder/        # Static analysis & doc generation
├── plugin-babel/   # Babel transformation plugin
├── runtime/        # Runtime execution helpers
└── cli/            # Command-line interface
```

## Quick Start

### For Users

```bash
# Install packages
bun add @soda-gql/core
bun add -D @soda-gql/cli @soda-gql/plugin-babel

# Scaffold scalar + adapter definitions for the runtime
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/inject.ts

# Generate GraphQL system from schema
bun run soda-gql codegen \
  --schema ./schema.graphql \
  --out ./src/graphql-system/index.ts \
  --inject-from ./src/graphql-system/inject.ts
```

The generated runtime module imports your scalar and adapter implementations from `inject.ts`. Keep that file under version control so custom scalar behaviour stays explicit. Declare each scalar with the `defineScalar()` helper exported by `@soda-gql/core`—for example `defineScalar("DateTime", ({ type }) => ({ input: type<string>(), output: type<Date>(), directives: {} }))`—so both input and output shapes stay typed.

### Basic Example

```typescript
import { gql } from "@/graphql-system";

// Define a reusable model with array-based API
export const userModel = gql.default(({ model }, { $ }) =>
  model.User(
    {
      variables: [$("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.id(null, { alias: "uuid" }),
      f.name(),
      f.posts({ categoryId: $.categoryId })(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
    (selection) => ({
      id: selection.uuid,
      name: selection.name,
      posts: selection.posts.map((post) => ({
        id: post.id,
        title: post.title,
      })),
    }),
  ),
);

// Create a query slice
export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!"), $("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.users({
        id: [$.id],
        categoryId: $.categoryId,
      })(() => [
        //
        userModel.fragment({ categoryId: $.categoryId }),
      ]),
    ],
    ({ select }) =>
      select(["$.users"], (result) =>
        result.safeUnwrap(([users]) => users.map((user) => userModel.normalize(user))),
      ),
  ),
);

// Build a complete operation
export const profileQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfileQuery",
      variables: [$("userId").scalar("ID:!"), $("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: userSlice.build({
        id: $.userId,
        categoryId: $.categoryId,
      }),
    }),
  ),
);
```

**Note on API**: Variables are now declared as arrays (`variables: [$(...)]`) and field builders return arrays of selections (`({ f }) => [ f.id(), f.name() ]`). Nested selections use curried callbacks (`f.posts(args)(({ f }) => [...])`). This improves type safety, prevents accidental key overwrites, and aligns better with GraphQL's structure.

### For Contributors

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check all packages
bun typecheck

# Run quality checks (Biome + TypeScript)
bun quality
```

## Development

This is a monorepo using Bun workspaces. Each package is independently versioned and can be developed in isolation.

### Available Scripts

- `bun quality` - Run Biome linting/formatting and TypeScript checks
- `bun typecheck` - Type check all packages
- `bun biome:check` - Run Biome with auto-fix

### Testing Approach

We follow TDD (Test-Driven Development) with the t_wada methodology:
1. Write test first (RED phase)
2. Make it pass (GREEN phase)
3. Refactor (REFACTOR phase)

### Code Conventions

- **TypeScript**: Strict mode enabled, no `any` types
- **Error Handling**: Using `neverthrow` for type-safe Results
- **Validation**: Using `zod` v4 for external data validation
- **Formatting**: Biome v2 with automatic import sorting

## License

MIT
