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
├── core/           # Core GraphQL types and utilities
├── codegen/        # Schema code generation
├── builder/        # Static analysis & artifact generation
├── babel-plugin/   # Babel transformation plugin
├── tsc-plugin/     # TypeScript compiler plugin
├── webpack-plugin/ # Webpack plugin with HMR support
├── runtime/        # Runtime execution helpers
└── cli/            # Command-line interface
```

## Quick Start

### For Users

```bash
# Install packages
bun add @soda-gql/core @soda-gql/runtime
bun add -D @soda-gql/cli @soda-gql/config
```

Create a `soda-gql.config.ts` file in your project root:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./src/graphql-system/runtime-adapter.ts",
      scalars: "./src/graphql-system/scalars.ts",
    },
  },
});
```

Generate the GraphQL system:

```bash
# Scaffold scalar and runtime adapter templates (first-time setup)
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/inject.ts

# Generate GraphQL system from schema
bun run soda-gql codegen
```

The generated runtime module imports your scalar and adapter implementations. Keep the `scalars.ts` and `runtime-adapter.ts` files under version control so custom scalar behavior stays explicit. Declare each scalar with the `defineScalar()` helper exported by `@soda-gql/core`—for example `defineScalar("DateTime", ({ type }) => ({ input: type<string>(), output: type<Date>(), directives: {} }))`—so both input and output shapes stay typed.

### Basic Example

```typescript
import { gql } from "@/graphql-system";

// Define a reusable model with array-based API
export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:?")],
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

// Build a complete operation
export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "ProfileQuery",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({
        id: [$.userId],
        categoryId: $.categoryId,
      })(({ f }) => [
        f.id(null, { alias: "uuid" }),
        f.name(),
        f.posts({ categoryId: $.categoryId })(({ f }) => [f.id(), f.title()]),
      ]),
    ],
  ),
);

// Operation with embedded model
export const profileQueryWithModel = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "ProfileQueryWithModel",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({
        id: [$.userId],
        categoryId: $.categoryId,
      })(({ f }) => [userModel.embed({ categoryId: $.categoryId })]),
    ],
  ),
);
```

**Note on API**: Variables are now declared as arrays (`variables: [$var(...)]`) and field builders return arrays of selections (`({ f }) => [ f.id(), f.name() ]`). Nested selections use curried callbacks (`f.posts(args)(({ f }) => [...])`). This improves type safety, prevents accidental key overwrites, and aligns better with GraphQL's structure.

### Metadata

Attach runtime information to operations for HTTP headers, GraphQL extensions, and application-specific values:

```typescript
// Operation with metadata
export const userQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
      metadata: ({ $ }) => ({
        headers: { "X-Request-ID": "user-query" },
        custom: { requiresAuth: true, cacheTtl: 300 },
      }),
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name()])],
  ),
);
```

Use `createMetadataAdapter` to set schema-level defaults and transformations:

```typescript
import { createMetadataAdapter } from "@soda-gql/core/metadata";

export const metadataAdapter = createMetadataAdapter({
  defaults: {
    headers: { "X-GraphQL-Client": "soda-gql" },
  },
  transform: ({ document, metadata }) => ({
    ...metadata,
    extensions: {
      ...metadata.extensions,
      persistedQuery: { sha256Hash: createHash("sha256").update(document).digest("hex") },
    },
  }),
});
```

See [@soda-gql/core README](./packages/core/README.md#metadata) for detailed documentation on metadata structure, merging behavior, and advanced usage.

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
