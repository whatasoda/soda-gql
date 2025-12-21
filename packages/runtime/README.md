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
- Runtime adapter for operation retrieval
- Minimal footprint for production builds

## Usage

### With Build-Time Transformation

When using soda-gql with a build plugin (Babel, TypeScript, Vite, etc.), the runtime is automatically integrated:

```typescript
// Your source code
import { gql } from "@/graphql-system";

export const userQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    { operationName: "GetUser", variables: [$("id").scalar("ID:!")] },
    ({ $ }) => ({ user: userSlice.build({ id: $.id }) }),
  ),
);

// After transformation (automatically handled by build plugin)
import { gqlRuntime } from "@soda-gql/runtime";

export const userQuery = gqlRuntime.getComposedOperation("canonicalId");
```

### Runtime Adapter

For custom client integrations, create a runtime adapter that defines error types:

```typescript
import { createRuntimeAdapter } from "@soda-gql/runtime";

export const adapter = createRuntimeAdapter(({ type }) => ({
  // Define the shape of non-GraphQL errors (network errors, etc.)
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
}));
```

## API Reference

### `gqlRuntime`

The main runtime object for operation management:

```typescript
import { gqlRuntime } from "@soda-gql/runtime";

// Get a composed operation by canonical ID
const operation = gqlRuntime.getComposedOperation("path/to/file.ts::userQuery");

// Get an inline operation
const inlineOp = gqlRuntime.getInlineOperation("canonicalId");

// Get a model
const model = gqlRuntime.getModel("canonicalId");

// Get a slice
const slice = gqlRuntime.getSlice("canonicalId");
```

### `createRuntimeAdapter(options)`

Create a custom runtime adapter for client integration:

```typescript
import { createRuntimeAdapter } from "@soda-gql/runtime";

const adapter = createRuntimeAdapter({
  errorTypes: {
    network: (message, cause) => new NetworkError(message, cause),
    unknown: (message, cause) => new UnknownError(message, cause),
  },
});
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
