---
name: soda-gql
description: |
  Assists with soda-gql zero-runtime GraphQL development. Use when the user asks to
  "set up soda-gql", "create GraphQL fragment", "create GraphQL operation",
  "configure soda-gql", "run soda-gql codegen", "GraphQL type inference",
  "troubleshoot soda-gql", "configure custom scalars", "add build plugin",
  or asks about soda-gql DSL patterns, configuration, or API.
---

# soda-gql Development Support

Provide comprehensive assistance for soda-gql, a zero-runtime GraphQL query generation system. Help users create type-safe GraphQL operations, configure projects, and troubleshoot issues.

## Overview

soda-gql brings PandaCSS's approach to GraphQL: write type-safe queries in TypeScript that transform at build time into optimized GraphQL documents.

**Key Features:**
- Full TypeScript inference from schema to query results
- No code generation loop (unlike traditional GraphQL codegen)
- Transform functions at fragment level
- Modular, composable architecture

**Architecture:**
- **Fragments**: Reusable type-safe field selections for GraphQL types
- **Operations**: Complete query/mutation/subscription definitions with field selections
- **Zero Runtime**: All transformations at build time, minimal runtime footprint

## Quick Start

### Installation

Install required packages:

```bash
bun add @soda-gql/core @soda-gql/runtime
bun add -D @soda-gql/cli @soda-gql/config
```

### Project Setup

**Option 1 - Use init command:**
```bash
bun run soda-gql init
```

**Option 2 - Manual setup:**

1. Create `soda-gql.config.ts`:
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

2. Scaffold inject template (first-time setup):
```bash
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

3. Generate GraphQL system:
```bash
bun run soda-gql codegen
```

### Generated Files

| File | Purpose | Version Control |
|------|---------|-----------------|
| `{schema}.inject.ts` | Custom scalar TypeScript types (hand-edit) | Commit |
| `index.ts` | Generated schema types and gql composer | .gitignore |
| `index.js`, `index.cjs` | Bundled output (by tsdown) | .gitignore |

## Core DSL Patterns

All definitions use `gql.default()` with a callback:

```typescript
import { gql } from "@/graphql-system";
```

### Fragments

Reusable field selections for a GraphQL type:

```typescript
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("includeEmail").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email(),
    }),
  }),
);
```

### Operations

Complete GraphQL operations with field selections:

```typescript
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

### Key Syntax Patterns

| Pattern | Description |
|---------|-------------|
| `...f.id()` | Select a field |
| `...f.posts({ limit: 10 })` | Field with arguments |
| `...f.posts()(({ f }) => ({...}))` | Nested selection (curried) |
| `...f.id(null, { alias: "uuid" })` | Field with alias |
| `...$var("name").ID("!")` | Required ID variable |
| `...$var("name").String("?")` | Optional String variable |
| `...fragment.spread({})` | Spread fragment fields |

### Variable Type Modifiers

| Modifier | Meaning | GraphQL Equivalent |
|----------|---------|-------------------|
| `"!"` | Required | `ID!` |
| `"?"` | Optional | `String` |
| `"![]!"` | Required list of required items | `[Int!]!` |
| `"![]?"` | Optional list of required items | `[String!]` |
| `"?[]!"` | Required list of optional items | `[Int]!` |
| `"?[]?"` | Optional list of optional items | `[String]` |

## Configuration

### Schema Configuration

Each schema requires:
- `schema`: Path to .graphql file
- `inject`: Path to inject file with scalar definitions

The inject file defines TypeScript types for GraphQL scalars:

```typescript
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"DateTime", string, Date>("DateTime"),
} as const;
```

### Multi-Schema Setup

```typescript
export default defineConfig({
  schemas: {
    users: { schema: "./users.graphql", inject: "./users.inject.ts" },
    products: { schema: "./products.graphql", inject: "./products.inject.ts" },
  },
});
```

Usage in code:
```typescript
const userQuery = gql.users(...);    // users schema
const productQuery = gql.products(...); // products schema
```

See `references/configuration.md` for full configuration options.

## CLI Commands

| Command | Description |
|---------|-------------|
| `soda-gql init` | Initialize project with starter files |
| `soda-gql codegen` | Generate GraphQL system from schema |
| `soda-gql codegen --emit-inject-template <path>` | Create inject template |
| `soda-gql codegen --config <path>` | Specify config file path |
| `soda-gql format` | Format gql definitions in source files |

## Type Inference

Extract TypeScript types from definitions:

```typescript
// Fragment types
type UserInput = typeof userFragment.$infer.input;
type UserOutput = typeof userFragment.$infer.output;

// Operation types
type Variables = typeof getUserQuery.$infer.input;
type Result = typeof getUserQuery.$infer.output.projected;
```

See `references/type-inference.md` for advanced patterns.

## Build Plugins

| Framework | Plugin | Package |
|-----------|--------|---------|
| Next.js | webpack-plugin | `@soda-gql/webpack-plugin` |
| Vite/Remix/Astro | vite-plugin | `@soda-gql/vite-plugin` |
| Expo/React Native | metro-plugin | `@soda-gql/metro-plugin` |
| NestJS | tsc-plugin | `@soda-gql/tsc-plugin` |
| Custom Babel | babel-plugin | `@soda-gql/babel-plugin` |

**Vite example:**
```typescript
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [sodaGqlPlugin()],
});
```

**Next.js example:**
```javascript
const { SodaGqlWebpackPlugin, SodaGqlWebpackLoader } = require("@soda-gql/webpack-plugin");

module.exports = {
  webpack: (config) => {
    config.plugins.push(new SodaGqlWebpackPlugin());
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      use: [{ loader: SodaGqlWebpackLoader }],
    });
    return config;
  },
};
```

See `references/plugins.md` for detailed setup instructions.

## Metadata

Attach runtime information to operations:

```typescript
export const userQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    metadata: ({ $ }) => ({
      headers: { "X-Request-ID": "user-query" },
      custom: { requiresAuth: true, cacheTtl: 300 },
    }),
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);
```

See `references/metadata.md` for advanced patterns.

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Cannot find '@/graphql-system' | Run `bun run soda-gql codegen` |
| Types not updating | Restart TypeScript server |
| SCHEMA_NOT_FOUND | Verify schema path in config |
| INJECT_MODULE_NOT_FOUND | Run codegen with `--emit-inject-template` |
| Transformations not applied | Check build plugin configuration |

See `references/troubleshooting.md` for full error code reference.

## Reference Documents

- `references/dsl-api.md` - Complete DSL API documentation
- `references/configuration.md` - Full configuration options
- `references/scalars-and-inject.md` - Custom scalar definitions
- `references/plugins.md` - Build plugin setup guides
- `references/troubleshooting.md` - Error codes and solutions
- `references/type-inference.md` - Advanced type patterns
- `references/metadata.md` - Metadata and adapter patterns

## Example Files

- `examples/basic-fragment.ts` - Simple fragment example
- `examples/basic-operation.ts` - Simple query operation
- `examples/fragment-with-variables.ts` - Fragment with variables
- `examples/nested-selections.ts` - Complex nested field selections
- `examples/fragment-spreading.ts` - Spreading fragments in operations
- `examples/custom-scalars.ts` - Custom scalar definitions
- `examples/multi-schema.ts` - Multi-schema configuration
- `examples/type-inference-usage.ts` - Type extraction examples
