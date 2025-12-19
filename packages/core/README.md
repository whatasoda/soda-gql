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

Reusable type-safe fragments with data normalization. Models define how to select fields from a GraphQL type and optionally transform the result.

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
export const userModel = gql.default(({ model }, { $ }) =>
  model.User(
    { variables: [$("includeEmail").scalar("Boolean:?")] },
    ({ f, $ }) => [
      f.id(),
      f.name(),
      f.email({ if: $.includeEmail }),
    ],
    (selection) => ({
      id: selection.id,
      name: selection.name,
      email: selection.email,
    }),
  ),
);
```

### Writing Slices

Slices define reusable operation fragments:

```typescript
export const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    { variables: [$("userId").scalar("ID:!")] },
    ({ f, $ }) => [
      f.user({ id: $.userId })(() => [
        userModel.fragment({}),
      ]),
    ],
    ({ select }) =>
      select(["$.user"], (result) =>
        result.safeUnwrap(([user]) => userModel.normalize(user)),
      ),
  ),
);
```

### Writing Operations (Composed)

Composed operations combine multiple slices:

```typescript
export const getUserQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$("id").scalar("ID:!")],
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
export const getUserInline = gql.default(({ query }, { $ }) =>
  query.inline(
    {
      operationName: "GetUserInline",
      variables: [$("id").scalar("ID:!")],
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
type UserOutputRaw = typeof userModel.$infer.output.raw;
type UserOutputNormalized = typeof userModel.$infer.output.normalized;

// Operation types
type QueryVariables = typeof getUserQuery.$infer.input;
type QueryResult = typeof getUserQuery.$infer.output.projected;
```

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
