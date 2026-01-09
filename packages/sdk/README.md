# @soda-gql/sdk

[![npm version](https://badge.fury.io/js/@soda-gql%2Fsdk.svg)](https://badge.fury.io/js/@soda-gql%2Fsdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Programmatic API for soda-gql prebuild operations.

## Installation

```bash
bun add @soda-gql/sdk
```

## Overview

This package provides a programmatic interface to soda-gql's build system, allowing external tools
and build plugins to execute artifact generation without invoking the CLI.

**Key Features:**

- Synchronous and asynchronous build APIs
- Optional context transformation for modifying composer context
- Configurable build options (force rebuild, evaluator ID, entrypoints override)
- Comprehensive error handling with typed Result

## Usage

### Basic Usage

```typescript
import { prebuild, prebuildAsync } from "@soda-gql/sdk";

// Synchronous build
const result = prebuild({
  configPath: "./soda-gql.config.ts",
});

if (result.isOk()) {
  const { artifact } = result.value;
  console.log(`Built ${Object.keys(artifact.elements).length} elements`);
} else {
  console.error("Build failed:", result.error);
}

// Asynchronous build
const asyncResult = await prebuildAsync({
  configPath: "./soda-gql.config.ts",
});
```

### With Context Transformer

```typescript
import { prebuildAsync } from "@soda-gql/sdk";

const result = await prebuildAsync({
  configPath: "./soda-gql.config.ts",
  contextTransformer: (context) => ({
    ...context,
    // Add custom context properties
    buildId: process.env.BUILD_ID,
    environment: "production",
  }),
});
```

### With Build Options

```typescript
import { prebuildAsync } from "@soda-gql/sdk";

const result = await prebuildAsync({
  configPath: "./soda-gql.config.ts",
  force: true, // Force rebuild, ignore cache
  evaluatorId: "my-build", // Custom evaluator ID for cache isolation
  entrypointsOverride: ["./src/graphql/**/*.ts"], // Override config.include
});
```

## API Reference

### `prebuild(options: PrebuildOptions): Result<PrebuildResult, PrebuildError>`

Synchronously builds GraphQL artifacts based on the provided configuration.

### `prebuildAsync(options: PrebuildOptions): Promise<Result<PrebuildResult, PrebuildError>>`

Asynchronously builds GraphQL artifacts. Preferred for build plugins and tools.

### Types

#### `PrebuildOptions`

| Property             | Type                      | Required | Description                                    |
| -------------------- | ------------------------- | -------- | ---------------------------------------------- |
| `configPath`         | `string`                  | Yes      | Path to soda-gql config file                   |
| `contextTransformer` | `ContextTransformer`      | No       | Function to modify composer context            |
| `force`              | `boolean`                 | No       | Force rebuild, ignore cache (default: false)   |
| `evaluatorId`        | `string`                  | No       | Unique evaluator ID (default: "default")       |
| `entrypointsOverride`| `string[] \| Set<string>` | No       | Override config.include patterns               |

#### `PrebuildResult`

```typescript
interface PrebuildResult {
  artifact: BuilderArtifact;
}
```

#### `PrebuildError`

Union type: `ConfigError | BuilderError`

#### `ContextTransformer`

```typescript
type ContextTransformer = (
  context: Record<string, unknown>
) => Record<string, unknown>;
```

## Session Lifecycle

`prebuild` and `prebuildAsync` internally create a BuilderSession and always call `dispose()` after
build completion (in a finally block).

### What `dispose()` does:

1. **Cache Persistence**: Saves incremental build cache to `node_modules/.cache/soda-gql/builder/cache.json`
2. **Exit Handler Cleanup**: Unregisters from process exit handler to prevent duplicate saves

### Notes:

- When using SDK, `dispose()` is called automatically - no manual cleanup needed
- Even if build fails, dispose is guaranteed to run via finally block
- Cache is shared across builds with the same `evaluatorId`

## Limitations

### Concurrent Execution

Do not run multiple `prebuild` or `prebuildAsync` calls concurrently with different
`contextTransformer` options. The context transformer uses global state and concurrent calls
may result in incorrect context being applied.

**Safe patterns:**

- Sequential builds with different transformers
- Concurrent builds without transformers
- Concurrent builds with the same transformer

## Related Packages

- [@soda-gql/builder](../builder) - Core build system
- [@soda-gql/config](../config) - Configuration loading
- [@soda-gql/core](../core) - GraphQL composition primitives

## License

MIT
