# @soda-gql/core

[![npm version](https://img.shields.io/npm/v/@soda-gql/core.svg)](https://www.npmjs.com/package/@soda-gql/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Core GraphQL types and utilities for the soda-gql ecosystem.

## Installation

```bash
bun add @soda-gql/core
```

## Overview

This package provides the foundational types and utilities used across all soda-gql packages. It includes:

- Core GraphQL types and type utilities
- TypedDocumentNode support for type-safe GraphQL operations
- Scalar definition helpers
- Runtime submodule for operation registration

## Usage

### Defining Custom Scalars

Use the `defineScalar` helper to create type-safe custom scalar definitions:

```typescript
import { defineScalar } from "@soda-gql/core";

export const DateTimeScalar = defineScalar("DateTime", ({ type }) => ({
  input: type<string>(),
  output: type<Date>(),
  directives: {},
}));

export const JSONScalar = defineScalar("JSON", ({ type }) => ({
  input: type<unknown>(),
  output: type<unknown>(),
  directives: {},
}));
```

### Runtime Submodule

The `/runtime` subpath export provides utilities for operation registration:

```typescript
import { gqlRuntime } from "@soda-gql/core/runtime";

// Register and retrieve operations at runtime
const operation = gqlRuntime.getComposedOperation("canonicalId");
```

## Exports

### Main Entry (`@soda-gql/core`)

- `defineScalar` - Helper for defining custom GraphQL scalars
- Core type utilities for GraphQL operations

### Runtime Entry (`@soda-gql/core/runtime`)

- `gqlRuntime` - Runtime operation registry and retrieval

## TypeScript Support

This package is written in TypeScript and provides complete type definitions. It requires TypeScript 5.x or later for full compatibility.

## Related Packages

- [@soda-gql/runtime](../runtime) - Runtime utilities for operation execution
- [@soda-gql/cli](../cli) - Command-line interface for code generation
- [@soda-gql/config](../config) - Configuration management

## License

MIT
