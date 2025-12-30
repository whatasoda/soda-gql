# @soda-gql/runtime

[![npm version](https://img.shields.io/npm/v/@soda-gql/runtime.svg)](https://www.npmjs.com/package/@soda-gql/runtime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Runtime utilities for soda-gql zero-runtime GraphQL operations.

## Installation

```bash
bun add @soda-gql/runtime
```

## Overview

This package provides the minimal runtime needed to execute soda-gql GraphQL operations. It includes:

- Operation registry for storing compiled GraphQL documents
- Runtime utilities for operation retrieval
- Minimal footprint for production builds

## Usage

### With Build-Time Transformation

When using soda-gql with a build plugin (Babel, TypeScript, Vite, etc.), the runtime is automatically integrated:

```typescript
// Your source code
import { gql } from "@/graphql-system";

export const userQuery = gql.default(({ query , $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);

// After transformation (automatically handled by build plugin)
import { gqlRuntime } from "@soda-gql/runtime";

export const userQuery = gqlRuntime.getOperation("canonicalId");
```

## API Reference

### `gqlRuntime`

The main runtime object for operation management:

```typescript
import { gqlRuntime } from "@soda-gql/runtime";

// Get an operation by canonical ID
const operation = gqlRuntime.getOperation("path/to/file.ts::userQuery");
```

## Zero-Runtime Philosophy

This package is designed to have minimal impact on bundle size:

- Operations are registered at build time
- No heavy dependencies
- Tree-shakeable exports

## Related Packages

- [@soda-gql/core](../core) - Core types and utilities
- [@soda-gql/babel-plugin](../babel-plugin) - Babel transformation plugin
- [@soda-gql/tsc-plugin](../tsc-plugin) - TypeScript transformation plugin

## License

MIT
