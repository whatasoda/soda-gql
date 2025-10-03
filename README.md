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
├── tool-utils/     # Build-time utilities
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

// Define a reusable model
const userModel = gql.model(
  ["User", { postCategoryId: gql.scalar("ID", "?") }],
  ({ f, $ }) => ({
    ...f.id(),
    ...f.name(),
    ...f.email(),
    ...f.posts(
      { postCategoryId: $.postCategoryId },
      ({ f }) => ({
        ...f.id(),
        ...f.title(),
      }),
    ),
  }),
  (data) => ({
    id: data.id,
    displayName: data.name,
    email: data.email.toLowerCase(),
    posts: data.posts.map((post) => ({
      id: post.id,
      title: post.title,
    })),
  })
);

// Create a query slice
const getUserQuery = gql.querySlice(
  [
    {
      id: gql.scalar("ID", "!"),
      postCategoryId: gql.scalar("ID", "?"),
    },
  ],
  ({ query, $ }) => ({
    user: query.user({ id: $.id, postCategoryId: $.postCategoryId }, userModel),
  }),
  ({ select }) => select("$.user", (result) => result.safeUnwrap((data) => data.user))
);

const pageQuery = gql.query(
  "PageQuery",
  {
    userId: gql.scalar("ID", "!"),
    postCategoryId: gql.scalar("ID", "?"),
  },
  ({ $ }) => ({
    user: getUserQuery({
      id: $.userId,
      postCategoryId: $.postCategoryId,
    }),
  }),
);
```

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
