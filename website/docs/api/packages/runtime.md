# @soda-gql/runtime

Minimal runtime utilities for soda-gql operations. This package provides the operation registry and runtime helpers.

## Installation

```bash
bun add @soda-gql/runtime
```

## Overview

soda-gql follows a "zero-runtime-like" philosophy. GraphQL documents and metadata are pre-computed at build time, while query execution happens at runtime:

- **Build Time**: Operations are analyzed, validated, and transformed
- **Runtime**: Only the operation registry and result parsing remain

This approach provides:
- Smaller bundle sizes
- Better tree-shaking
- Faster execution

## gqlRuntime API

The `gqlRuntime` object provides access to registered operations:

```typescript
import { gqlRuntime } from "@soda-gql/runtime";
```

### getOperation()

Retrieve a registered operation by its canonical ID:

```typescript
const operation = gqlRuntime.getOperation("canonicalId");

if (operation) {
  console.log(operation.document);
  console.log(operation.variables);
}
```

:::info
Operations are automatically registered by build plugins during transformation. You typically don't need to call `getOperation` directly.
:::

## How It Works

### Source Code

Your soda-gql code before transformation:

```typescript
import { gql } from "@/graphql-system";

export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);
```

### Transformed Code

After build plugin transformation:

```typescript
import { gqlRuntime } from "@soda-gql/runtime";

export const getUserQuery = gqlRuntime.getOperation("abc123");
```

The operation details are registered in a separate runtime registry, and your code only contains a lightweight reference.

## Adapter Definition

The adapter is defined in the inject file using `defineAdapter` from `@soda-gql/core/adapter`:

```typescript
// src/graphql-system/default.inject.ts
import { defineAdapter, defineScalar } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;

export const adapter = defineAdapter({
  helpers: {},
  metadata: {
    aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
  },
});
```

### Custom Error Types

Define application-specific error types for runtime handling:

```typescript
export const adapter = defineAdapter({
  helpers: {
    parseError: (error: unknown) => ({
      type: "parse-error" as const,
      cause: error,
    }),
  },
  metadata: {
    aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
  },
});
```

## Integration with Build Plugins

Each build plugin handles the transformation:

| Plugin | Transformer |
|--------|-------------|
| Vite Plugin | SWC Transformer |
| Webpack Plugin | SWC Transformer |
| Metro Plugin | Babel Transformer |
| TSC Plugin | TypeScript Transformer |

All plugins:
1. Analyze your soda-gql code at build time
2. Extract operation details
3. Register operations with `gqlRuntime`
4. Replace source code with lightweight references

## Bundle Impact

The runtime package is designed to be minimal:

- Core registry: ~1KB minified
- Per-operation overhead: ~100 bytes

Operations are lazy-loaded and tree-shakable when not used.
