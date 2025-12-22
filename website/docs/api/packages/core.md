# @soda-gql/core

Core GraphQL types, utilities, and primitives for soda-gql.

:::warning Work in Progress
This documentation is being developed.
:::

## Installation

```bash
bun add @soda-gql/core
```

## Overview

`@soda-gql/core` provides the foundational types and utilities for defining GraphQL models, slices, and operations.

## Key Exports

### `defineScalar`

Define custom scalar types with input/output transformations:

```typescript
import { defineScalar } from "@soda-gql/core";

const DateTimeScalar = defineScalar("DateTime", ({ type }) => ({
  input: type<string>(),
  output: type<Date>(),
  directives: {},
}));
```

### `gql` (generated)

The `gql` object is generated per-schema and provides builders for:

- `model.<TypeName>()` - Define reusable fragments
- `query.slice()` / `mutation.slice()` - Define reusable slices
- `query.composed()` / `mutation.composed()` - Compose operations from slices
- `query.inline()` / `mutation.inline()` - Define inline operations

## Type Utilities

- `type<T>()` - Type-only marker for scalar definitions
- `$var()` - Variable declaration builder
- `$` - Variable reference accessor

## See Also

- [Getting Started](/guide/getting-started) - Basic usage examples
- [@soda-gql/runtime](/api/packages/runtime) - Runtime execution
