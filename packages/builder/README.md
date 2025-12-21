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
        runtimeAdapter: "./runtime-adapter.ts",
        scalars: "./scalars.ts",
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

- `analyze()` - Analyze source files and generate artifacts
- `getArtifact()` - Retrieve the current build artifact
- `invalidate(filePath)` - Invalidate cache for a specific file

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
