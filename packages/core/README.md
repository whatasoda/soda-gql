# @soda-gql/core

[![npm version](https://img.shields.io/npm/v/@soda-gql/core.svg)](https://www.npmjs.com/package/@soda-gql/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Core GraphQL types and utilities for the soda-gql ecosystem. This package provides the foundational building blocks for writing type-safe GraphQL operations.

## Installation

```bash
bun add @soda-gql/core
```

## Core Concepts

soda-gql uses two main building blocks for constructing GraphQL operations:

### Fragments

Reusable type-safe field selections. Fragments define how to select fields from a GraphQL type and can be spread in operations.

### Operations

Complete GraphQL operations (query/mutation/subscription) with field selections. Operations define variables, select fields, and can spread fragments for reusable field selections.

## Usage

All soda-gql definitions use the `gql.default()` pattern, which is provided by the generated GraphQL system:

```typescript
import { gql } from "@/graphql-system";
```

### Writing Fragments

Fragments define reusable field selections for a specific GraphQL type:

```typescript
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("includeEmail").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email({ if: $.includeEmail }),
    }),
  }),
);
```

### Writing Operations

Operations define complete GraphQL queries, mutations, or subscriptions:

```typescript
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);

// Operation with spread fragment
export const getUserWithFragment = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUserWithFragment",
    variables: { ...$var("id").ID("!"), ...$var("includeEmail").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ ...userFragment.spread({ includeEmail: $.includeEmail }) })),
    }),
  }),
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
| `...f.id()` | Basic field selection |
| `...f.posts({ limit: 10 })` | Field with arguments |
| `...f.posts()(({ f }) => ({ ... }))` | Nested selection (curried) |
| `...f.id(null, { alias: "uuid" })` | Field with alias |
| `...f.email({ if: $.includeEmail })` | Conditional field |
| `...userFragment.spread({})` | Use fragment fields |

## Understanding the Inject Module

The inject module (`{schema}.inject.ts`) bridges your GraphQL schema with TypeScript types.

**Why hand-written?**
- Custom scalar types (DateTime, JSON, etc.) need explicit TypeScript type mappings
- Version-controlled to keep type behavior explicit and reviewable

**What it contains:**
- `scalar`: TypeScript type definitions for each GraphQL scalar

**Scaffolding:**
```bash
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

This creates a template with standard scalars (ID, String, Int, Float, Boolean) that you can customize.

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
// Fragment types
type UserInput = typeof userFragment.$infer.input;
type UserOutput = typeof userFragment.$infer.output;

// Operation types
type QueryVariables = typeof getUserQuery.$infer.input;
type QueryResult = typeof getUserQuery.$infer.output.projected;
```

## Element Extensions

The `attach()` method allows extending gql elements with custom properties. This is useful for colocating related functionality with fragment or operation definitions.

### Basic Usage

```typescript
import type { GqlElementAttachment } from "@soda-gql/core";

// Define an attachment
const myAttachment: GqlElementAttachment<typeof userFragment, "custom", { value: number }> = {
  name: "custom",
  createValue: (element) => ({ value: 42 }),
};

// Attach to a fragment
export const userFragment = gql
  .default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }))
  .attach(myAttachment);

// Access the attached property
userFragment.custom.value; // 42
```

### Type Safety

Attachments are fully typed. The returned element includes the new property in its type:

```typescript
const fragment = gql.default(...).attach({ name: "foo", createValue: () => ({ bar: 1 }) });
// Type: Fragment<...> & { foo: { bar: number } }
```

## Metadata

Metadata allows you to attach runtime information to operations. This is useful for HTTP headers and application-specific values.

### Metadata Structure

All metadata types share two base properties:

| Property | Type | Purpose |
|----------|------|---------|
| `headers` | `Record<string, string>` | HTTP headers to include with the GraphQL request |
| `custom` | `Record<string, unknown>` | Application-specific values (auth requirements, cache settings, etc.) |

### Defining Metadata

Metadata is defined on operations:

```typescript
// Operation with metadata
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    metadata: ({ $, document }) => ({
      headers: { "X-Request-ID": "user-query" },
      custom: {
        requiresAuth: true,
        cacheTtl: 300,
        trackedVariables: [$var.getInner($.id)],
      },
    }),
    fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);
```

## Runtime Exports

The `/runtime` subpath provides utilities for operation registration and retrieval:

```typescript
import { gqlRuntime } from "@soda-gql/core/runtime";

// Retrieve registered operations (typically handled by build plugins)
const operation = gqlRuntime.getOperation("canonicalId");
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
