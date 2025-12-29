# @soda-gql/core

Core GraphQL types, utilities, and primitives for soda-gql.

## Installation

```bash
bun add @soda-gql/core
```

## Overview

`@soda-gql/core` provides the foundational types and utilities for defining GraphQL fragments and operations.

## defineScalar

Define custom scalar types with input/output transformations:

```typescript
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  // Simple syntax
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),

  // Callback syntax with directives
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),
    output: type<Date>(),
    directives: {},
  })),
} as const;
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `name` | The GraphQL scalar name |
| `options` or callback | Type configuration |

### Callback Parameters

| Property | Type | Description |
|----------|------|-------------|
| `input` | `type<T>()` | TypeScript type for input (variables) |
| `output` | `type<T>()` | TypeScript type for output (responses) |
| `directives` | `object` | Directive definitions |

## gql (Generated)

The `gql` object is generated per-schema and provides builders:

```typescript
import { gql } from "@/graphql-system";

// Fragment builder
gql.default(({ fragment }) => fragment.User({}, ({ f }) => [...]));

// Query operation
gql.default(({ query }) => query.operation({...}, ({ f, $ }) => [...]));

// Mutation operation
gql.default(({ mutation }) => mutation.operation({...}, ({ f, $ }) => [...]));

// Subscription operation (planned)
gql.default(({ subscription }) => subscription.operation({...}, ({ f, $ }) => [...]));
```

## Element Extensions (attach)

The `attach()` method extends gql elements with custom properties:

```typescript
import type { GqlElementAttachment } from "@soda-gql/core";

export const userFragment = gql
  .default(({ fragment }) =>
    fragment.User({}, ({ f }) => [
      //
      f.id(),
      f.name(),
    ]),
  )
  .attach({
    name: "utils",
    createValue: (element) => ({
      getDisplayName: (user: typeof element.$infer.output) =>
        user.name.toUpperCase(),
    }),
  });

// Usage
userFragment.utils.getDisplayName(userData);
```

### GqlElementAttachment Interface

```typescript
interface GqlElementAttachment<TElement, TName extends string, TValue> {
  name: TName;
  createValue: (element: TElement) => TValue;
}
```

### Chaining Attachments

Multiple attachments can be chained:

```typescript
const fragment = gql
  .default(...)
  .attach(attachment1)
  .attach(attachment2);

// Access both
fragment.attachment1Name;
fragment.attachment2Name;
```

## Metadata API

Define runtime metadata on operations:

```typescript
gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("id").scalar("ID:!")],
      metadata: ({ $, document, $var }) => ({
        headers: { "X-Request-ID": "get-user" },
        custom: { requiresAuth: true, hash: hashDocument(document) },
      }),
    },
    ({ f, $ }) => [
      //
      ...
    ],
  ),
);
```

### Metadata Structure

| Property | Type | Description |
|----------|------|-------------|
| `headers` | `Record<string, string>` | HTTP headers |
| `custom` | `Record<string, unknown>` | Application-specific values |

### Accessing Metadata

```typescript
const meta = operation.metadata({ id: "123" });
console.log(meta.headers);
console.log(meta.custom);
```

## Variable Type Syntax Reference

Complete reference for the `$var().scalar()` type specifier:

### Basic Types

| Specifier | GraphQL | TypeScript |
|-----------|---------|------------|
| `"ID:!"` | `ID!` | `string` |
| `"ID:?"` | `ID` | `string \| undefined` |
| `"String:!"` | `String!` | `string` |
| `"String:?"` | `String` | `string \| undefined` |
| `"Int:!"` | `Int!` | `number` |
| `"Int:?"` | `Int` | `number \| undefined` |
| `"Float:!"` | `Float!` | `number` |
| `"Float:?"` | `Float` | `number \| undefined` |
| `"Boolean:!"` | `Boolean!` | `boolean` |
| `"Boolean:?"` | `Boolean` | `boolean \| undefined` |

### List Types

| Specifier | GraphQL | Description |
|-----------|---------|-------------|
| `"String:![]!"` | `[String!]!` | Required list of required strings |
| `"String:![]?"` | `[String!]` | Optional list of required strings |
| `"String:?[]!"` | `[String]!` | Required list of optional strings |
| `"String:?[]?"` | `[String]` | Optional list of optional strings |

### Nested Lists

| Specifier | GraphQL |
|-----------|---------|
| `"Int:![]![]!"` | `[[Int!]!]!` |
| `"String:?[]?[]?"` | `[[String]]` |

### Custom Types

```typescript
$var("input").scalar("CreateUserInput:!")
$var("filters").scalar("FilterInput:![]?")
```

## Field Selection Patterns Reference

Complete reference for field selection API:

| Pattern | Example | Description |
|---------|---------|-------------|
| Basic field | `f.id()` | Select a scalar field |
| With arguments | `f.posts({ limit: 10 })` | Field with arguments |
| Nested (curried) | `f.posts()(({ f }) => [...])` | Nested selections |
| With alias | `f.id(null, { alias: "userId" })` | Renamed field |
| Fragment embed | `userFragment.embed({})` | Embed fragment fields |
| Fragment with vars | `userFragment.embed({ a: $.b })` | Pass variables |

## Type Inference

Extract TypeScript types using `$infer`:

```typescript
// Fragment types
type UserInput = typeof userFragment.$infer.input;
type UserOutput = typeof userFragment.$infer.output;

// Operation types
type QueryVariables = typeof query.$infer.input;
type QueryResult = typeof query.$infer.output.projected;

// Metadata type
type QueryMeta = typeof query.$infer.metadata;
```

## Runtime Exports

The `/runtime` subpath provides runtime utilities:

```typescript
import { gqlRuntime } from "@soda-gql/core/runtime";

// Get registered operation
const operation = gqlRuntime.getOperation("canonicalId");
```

## TypeScript Requirements

- TypeScript 5.x or later for full type inference
- Strict mode recommended for best type safety

## See Also

- [Fragments Guide](/guide/fragments) - Fragment usage patterns
- [Operations Guide](/guide/operations) - Operation usage patterns
- [Variables Guide](/guide/variables) - Variable syntax details
- [Metadata Guide](/guide/metadata) - Metadata usage
