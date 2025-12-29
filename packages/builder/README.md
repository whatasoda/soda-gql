# @soda-gql/builder

[![npm version](https://img.shields.io/npm/v/@soda-gql/builder.svg)](https://www.npmjs.com/package/@soda-gql/builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Static analysis and artifact generation engine for soda-gql.

## Installation

```bash
bun add -D @soda-gql/builder
```

> **Note**: This package is typically used indirectly via build plugins or the CLI. Direct usage is only needed for advanced integration scenarios.

## Overview

This package provides the core static analysis engine that powers soda-gql's build-time transformations:

- Source code analysis for `gql.default()` calls
- Canonical ID generation for operation tracking
- Artifact generation for runtime transformations
- Support for TypeScript and SWC analyzers

## Features

- **Static Analysis**: Analyzes TypeScript source files to discover GraphQL operations
- **Canonical ID Tracking**: Generates unique identifiers for each operation based on file path and AST location
- **Artifact Generation**: Creates build artifacts used by transformation plugins
- **Multi-Analyzer Support**: Works with both TypeScript and SWC parsers

## Programmatic Usage

For custom build tool integrations:

```typescript
import { createBuilder } from "@soda-gql/builder";

const builder = await createBuilder({
  config: {
    outdir: "./graphql-system",
    include: ["./src/**/*.ts"],
    analyzer: "ts",
    schemas: {
      default: {
        schema: "./schema.graphql",
        inject: "./default.inject.ts",
      },
    },
  },
});

// Analyze source files
const analysisResult = await builder.analyze();

if (analysisResult.isOk()) {
  const artifact = analysisResult.value;
  // Use artifact for transformations
}
```

## API Reference

### `createBuilder(options)`

Creates a builder instance for static analysis:

```typescript
const builder = await createBuilder({
  config: SodaGqlConfig,
  cwd?: string,
});
```

### Builder Methods

- `build(options?)` - Synchronously analyze source files and generate artifacts
- `buildAsync(options?)` - Asynchronously analyze source files (supports parallel I/O)
- `getGeneration()` - Get the current build generation number
- `getCurrentArtifact()` - Retrieve the current build artifact

### Async Build API

For better performance in large codebases, use the async build API:

```typescript
import { createBuilder } from "@soda-gql/builder";

const builder = await createBuilder({ config });

// Async build with parallel file I/O
const result = await builder.buildAsync();

if (result.isOk()) {
  const artifact = result.value;
  // Use artifact for transformations
}

// Incremental rebuild (only processes changed files)
const incrementalResult = await builder.buildAsync();
```

The async API is recommended for:
- Large codebases with many source files
- Build tools that benefit from parallel I/O
- Environments where non-blocking operations are preferred

## Analyzer Options

| Analyzer | Description | Use Case |
|----------|-------------|----------|
| `"ts"` | TypeScript compiler API | Best type accuracy, slower |
| `"swc"` | SWC parser | Faster parsing, good for large codebases |

## Related Packages

- [@soda-gql/cli](../cli) - Command-line interface
- [@soda-gql/babel-plugin](../babel-plugin) - Babel transformation plugin
- [@soda-gql/tsc-plugin](../tsc-plugin) - TypeScript transformation plugin
- [@soda-gql/plugin-common](../plugin-common) - Shared plugin utilities

## License

MIT
