# @soda-gql/core

[![npm version](https://img.shields.io/npm/v/@soda-gql/core.svg)](https://www.npmjs.com/package/@soda-gql/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Core GraphQL types and utilities for the soda-gql ecosystem. This package provides the foundational building blocks for writing type-safe GraphQL operations.

## Installation

```bash
bun add @soda-gql/core
```

## Core Concepts

soda-gql uses three main building blocks for constructing GraphQL operations:

### Models

Reusable type-safe fragments. Models define how to select fields from a GraphQL type.

### Slices

Domain-specific query/mutation/subscription pieces. Slices are reusable operation fragments that can be composed into complete operations.

### Operations

Complete GraphQL operations that can be executed. There are two types:
- **Composed Operations**: Built by combining multiple slices
- **Inline Operations**: Self-contained operations with field selections defined directly

## Usage

All soda-gql definitions use the `gql.default()` pattern, which is provided by the generated GraphQL system:

```typescript
import { gql } from "@/graphql-system";
```

### Writing Models

Models define reusable fragments for a specific GraphQL type:

```typescript
export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    { variables: [$var("includeEmail").scalar("Boolean:?")] },
    ({ f, $ }) => [
      f.id(),
      f.name(),
      f.email({ if: $.includeEmail }),
    ],
  ),
);
```

### Writing Slices

Slices define reusable operation fragments:

```typescript
export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    { variables: [$var("userId").scalar("ID:!")] },
    ({ f, $ }) => [
      f.user({ id: $.userId })(() => [
        userModel.fragment({}),
      ]),
    ],
    ({ select }) =>
      select(["$.user"], (result) => result.safeUnwrap(([user]) => user)),
  ),
);
```

### Writing Operations (Composed)

Composed operations combine multiple slices:

```typescript
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$var("id").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ userId: $.id }),
    }),
  ),
);
```

### Writing Operations (Inline)

Inline operations define field selections directly:

```typescript
export const getUserInline = gql.default(({ query }, { $var }) =>
  query.inline(
    {
      operationName: "GetUserInline",
      variables: [$var("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.user({ id: $.id })(({ f }) => [
        f.id(),
        f.name(),
      ]),
    ],
  ),
);
```

## Variable Type Syntax

Variables are declared using a string-based type syntax:

| Syntax | Meaning | GraphQL Equivalent |
|--------|---------|-------------------|
| `"ID:!"` | Required ID | `ID!` |
| `"String:?"` | Optional String | `String` |
| `"Int:![]!"` | Required list of required Int | `[Int!]!` |
| `"String:![]?"` | Optional list of required Strings | `[String!]` |
| `"MyInput:!"` | Required custom input type | `MyInput!` |

## Field Selection Patterns

| Pattern | Description |
|---------|-------------|
| `f.id()` | Basic field selection |
| `f.posts({ limit: 10 })` | Field with arguments |
| `f.posts()(({ f }) => [...])` | Nested selection (curried) |
| `f.id(null, { alias: "uuid" })` | Field with alias |
| `f.email({ if: $.includeEmail })` | Conditional field |
| `userModel.fragment({})` | Use model fragment |

## Defining Custom Scalars

Scalars define the TypeScript types for GraphQL scalar values:

```typescript
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  // Built-in scalars
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),

  // Custom scalars - defineScalar<Name, InputType, OutputType>(name)
  ...defineScalar<"DateTime", string, Date>("DateTime"),
  ...defineScalar<"JSON", Record<string, unknown>, Record<string, unknown>>("JSON"),
} as const;
```

Alternative callback syntax:

```typescript
export const scalar = {
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),
    output: type<Date>(),
    directives: {},
  })),
} as const;
```

## Type Inference

Extract TypeScript types from soda-gql elements using `$infer`:

```typescript
// Model types
type UserInput = typeof userModel.$infer.input;
type UserOutput = typeof userModel.$infer.output;

// Operation types
type QueryVariables = typeof getUserQuery.$infer.input;
type QueryResult = typeof getUserQuery.$infer.output.projected;
```

## Metadata

Metadata allows you to attach runtime information to operations and slices. This is useful for HTTP headers, GraphQL extensions, and application-specific values.

### Metadata Structure

All metadata types share three base properties:

| Property | Type | Purpose |
|----------|------|---------|
| `headers` | `Record<string, string>` | HTTP headers to include with the GraphQL request |
| `extensions` | `Record<string, unknown>` | GraphQL extensions in the request payload |
| `custom` | `Record<string, unknown>` | Application-specific values (auth requirements, cache settings, etc.) |

### Defining Metadata

Metadata can be defined on both slices and operations:

```typescript
// Slice with metadata
export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("userId").scalar("ID:!")],
      metadata: ({ $ }) => ({
        headers: { "X-Request-ID": "user-query" },
        custom: { requiresAuth: true, cacheTtl: 300 },
      }),
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
    ({ select }) => select(["$.user"], (user) => user),
  ),
);

// Operation with metadata (can reference variables and document)
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$var("id").scalar("ID:!")],
      metadata: ({ $, document }) => ({
        extensions: {
          trackedVariables: [$var.getInner($.id)],
        },
      }),
    },
    ({ $ }) => ({
      user: userSlice.embed({ userId: $.id }),
    }),
  ),
);
```

### MetadataAdapter

Use `createMetadataAdapter` to customize metadata behavior at the schema level:

```typescript
import { createMetadataAdapter } from "@soda-gql/core/metadata";
import { createHash } from "crypto";

export const metadataAdapter = createMetadataAdapter({
  // Default metadata applied to all operations
  defaults: {
    headers: { "X-GraphQL-Client": "soda-gql" },
  },

  // Transform metadata at build time (e.g., add persisted query hash)
  transform: ({ document, metadata }) => ({
    ...metadata,
    extensions: {
      ...metadata.extensions,
      persistedQuery: {
        version: 1,
        sha256Hash: createHash("sha256").update(document).digest("hex"),
      },
    },
  }),

  // Custom merge strategy for slice metadata (optional)
  mergeSliceMetadata: (operationMetadata, sliceMetadataList) => {
    // Default: shallow merge where operation takes precedence
    return { ...sliceMetadataList.reduce((acc, s) => ({ ...acc, ...s }), {}), ...operationMetadata };
  },
});
```

### Metadata Merging

When an operation includes multiple slices, metadata is merged in this order:

1. **Slice metadata** - Merged together (later slices override earlier ones)
2. **Operation metadata** - Takes precedence over slice metadata
3. **Schema defaults** - Applied first, overridden by operation/slice values

## Runtime Exports

The `/runtime` subpath provides utilities for operation registration and retrieval:

```typescript
import { gqlRuntime } from "@soda-gql/core/runtime";

// Retrieve registered operations (typically handled by build plugins)
const operation = gqlRuntime.getComposedOperation("canonicalId");
```

## TypeScript Support

This package requires TypeScript 5.x or later for full type inference support.

## Related Packages

- [@soda-gql/cli](../cli) - Command-line interface for code generation
- [@soda-gql/config](../config) - Configuration management
- [@soda-gql/runtime](../runtime) - Runtime utilities for operation execution
- [@soda-gql/tsc-plugin](../tsc-plugin) - TypeScript compiler plugin

## License

MIT
