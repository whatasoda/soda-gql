# @soda-gql - Zero-runtime GraphQL Query Generation

A zero-runtime GraphQL query generation system that brings PandaCSS's approach to GraphQL. Write type-safe queries in TypeScript that are statically analyzed and transformed at build time into optimized GraphQL documents.

## Features

- 🔍 **Full Type Safety**: Complete TypeScript inference from schema to query results
- 🎯 **No Code Generation Loop**: Unlike traditional GraphQL codegen, no constant regeneration needed
- 🔧 **Transform Functions**: Built-in data normalization at the fragment level
- 📦 **Modular Architecture**: Compose queries from reusable fragments
- ⚡ **Instant Feedback**: Type errors appear immediately in your IDE

## Project Structure

```
packages/
├── core/           # Core GraphQL types and utilities
├── codegen/        # Schema code generation
├── builder/        # Static analysis & artifact generation
├── babel/          # Babel transformer and plugin
├── tsc/            # TypeScript transformer and plugin
├── swc/            # SWC-based native transformer
├── webpack-plugin/ # Webpack plugin with HMR support
├── vite-plugin/    # Vite plugin
├── metro-plugin/   # Metro plugin (React Native)
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
      inject: "./src/graphql-system/default.inject.ts",
    },
  },
});
```

Generate the GraphQL system:

```bash
# Scaffold inject template with scalar and adapter definitions (first-time setup)
bun run soda-gql codegen schema --emit-inject-template ./src/graphql-system/default.inject.ts

# Generate GraphQL system from schema
bun run soda-gql codegen schema
```

The generated module imports your scalar definitions from the inject file. Keep the inject file (e.g., `default.inject.ts`) under version control so custom scalar behavior stays explicit.

### Generated Files

| File | Purpose | Version Control |
|------|---------|-----------------|
| `{schema}.inject.ts` | Custom scalar TypeScript types (hand-edit) | ✅ Commit |
| `index.ts` | Generated schema types and gql composer | ❌ .gitignore |
| `index.js`, `index.cjs` | Bundled output (by tsdown) | ❌ .gitignore |

**Note**: The inject file defines TypeScript types for custom scalars (DateTime, JSON, etc.). Scaffold it once with `--emit-inject-template`, then customize as needed. The generated `index.ts` and bundled outputs should be added to `.gitignore`.

### Migrating from .graphql Files

Already have `.graphql` operation files? Generate soda-gql compat code:

```bash
bun run soda-gql codegen graphql --input "src/**/*.graphql"
```

This creates TypeScript files using the compat pattern, preserving your existing operations while gaining full type safety.

### Basic Example

soda-gql supports two syntax styles: **tagged templates** (recommended for most cases) and **callback builders** (for advanced features).

#### Tagged Template Syntax (Recommended)

Write GraphQL directly — fragments and operations use familiar GraphQL syntax:

```typescript
import { gql } from "@/graphql-system";

// Define a reusable fragment
export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment($categoryId: ID) on User {
    id
    name
    posts(categoryId: $categoryId) {
      id
      title
    }
  }`(),
);

// Build a complete operation
export const listUsersQuery = gql.default(({ query }) =>
  query`query ListUsers($categoryId: ID) {
    users {
      id
      name
      posts(categoryId: $categoryId) {
        id
        title
      }
    }
  }`(),
);
```

#### Callback Builder Syntax (Advanced Features)

Use callback builders when you need features like fragment spreads in operations, field aliases, metadata callbacks, or `$colocate`:

```typescript
import { gql } from "@/graphql-system";

// Fragment with field alias (callback builder only)
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.id(null, { alias: "uuid" }),
      ...f.name(),
      ...f.posts({ categoryId: $.categoryId })(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  }),
);

// Operation with fragment spread (callback builder only)
export const profileQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfileQuery",
    variables: { ...$var("userId").ID("!"), ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.users({
        id: [$.userId],
        categoryId: $.categoryId,
      })(({ f }) => ({ ...userFragment.spread({ categoryId: $.categoryId }) })),
    }),
  }),
);
```

**When to use each syntax:**
| Feature | Tagged Template | Callback Builder |
|---------|:-:|:-:|
| Simple field selections | Yes | Yes |
| Variables and arguments | Yes | Yes |
| Nested object selections | Yes | Yes |
| Fragment spreads in fragments | Yes (`${otherFragment}`) | Yes (`.spread()`) |
| Fragment spreads in operations | — | Yes (`.spread()`) |
| Field aliases | — | Yes |
| Metadata callbacks | — | Yes |
| `$colocate` | — | Yes |
| Document transforms | — | Yes |

### Metadata

Attach runtime information to operations for HTTP headers and application-specific values:

```typescript
// Operation with metadata
export const userQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    metadata: ({ $ }) => ({
      headers: { "X-Request-ID": "user-query" },
      custom: { requiresAuth: true, cacheTtl: 300 },
    }),
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);
```

See [@soda-gql/core README](./packages/core/README.md#metadata) for detailed documentation on metadata structure and advanced usage.

### Define Element (Value Sharing)

Use `define` to share configuration values and helper functions across multiple gql definitions:

```typescript
// shared/config.ts
export const ApiConfig = gql.default(({ define }) =>
  define(() => ({
    defaultTimeout: 5000,
    retryCount: 3,
  }))
);

// queries/user.ts
import { ApiConfig } from "../shared/config";

export const GetUser = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    metadata: () => ({
      custom: { timeout: ApiConfig.value.defaultTimeout },
    }),
    fields: ({ f, $ }) => ({ ... }),
  })
);
```

Values defined with `define` pass builder evaluation but are excluded from the final artifact.

See [Define Element Guide](./docs/guides/define-element.md) for detailed documentation.

### Prebuilt Types (Bundler Compatibility)

When bundling with tools like tsdown, rollup-plugin-dts, or other bundlers that merge declaration files, complex type inference (like `InferFields`) may be lost at module boundaries. The prebuilt types feature solves this by pre-calculating types at build time.

#### Enabling Prebuilt Types

Generate prebuilt module alongside the regular output:

```bash
# First generate the GraphQL system
bun run soda-gql codegen schema

# Then generate prebuilt types
bun run soda-gql typegen
```

This creates additional files in your output directory:

```
{config.outdir}/
├── index.ts           # Regular module with full type inference
└── prebuilt/
    ├── index.ts       # Prebuilt module using type registry
    └── types.ts       # Type definitions for fragments/operations
```

#### Using Fragment Keys

Fragments require a `key` property to be included in prebuilt types. Fragments without keys work at runtime but are **silently skipped** during prebuilt type generation:

```typescript
// Fragment with key for prebuilt type lookup
export const userFragment = gql.default(({ fragment }) =>
  fragment.User("UserFields")`
    id
    name
  `(),
);
```

Operations are automatically keyed by their `name` property.

#### Bundler Configuration

Configure your bundler to use the prebuilt module via path aliases. Replace `<outdir>` with your codegen output directory (e.g., `./src/graphql-system`):

**tsdown / tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "<outdir>": ["<outdir>/prebuilt"]
    }
  }
}
```

**Vite:**
```typescript
export default {
  resolve: {
    alias: {
      "<outdir>": "<outdir>/prebuilt"
    }
  }
}
```

**Webpack:**
```typescript
module.exports = {
  resolve: {
    alias: {
      "<outdir>": "<outdir>/prebuilt"
    }
  }
}
```

The same source code works in both modes - type inference happens at development time (regular mode), while bundled output uses prebuilt types.

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
