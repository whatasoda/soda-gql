# @soda-gql/codegen

[![npm version](https://img.shields.io/npm/v/@soda-gql/codegen.svg)](https://www.npmjs.com/package/@soda-gql/codegen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Multi-schema GraphQL code generation engine for soda-gql.

## Installation

```bash
bun add -D @soda-gql/codegen
```

> **Note**: This package is typically used indirectly via [@soda-gql/cli](../cli). Direct usage is only needed for advanced integration scenarios.

## Overview

This package provides the code generation engine that transforms GraphQL schemas into type-safe TypeScript modules. It supports:

- Multiple schema configurations
- Custom scalar definitions
- Runtime adapter integration
- Incremental generation

## Programmatic Usage

For advanced use cases where you need to integrate code generation into your own build pipeline:

```typescript
import { runMultiSchemaCodegen } from "@soda-gql/codegen";

const result = await runMultiSchemaCodegen({
  outdir: "./src/graphql-system",
  schemas: {
    default: {
      schemaPath: "./schema.graphql",
      runtimeAdapterPath: "./runtime-adapter.ts",
      scalarsPath: "./scalars.ts",
    },
  },
});

if (result.isErr()) {
  console.error("Code generation failed:", result.error);
} else {
  console.log("Code generation successful");
}
```

## Features

- **Multi-Schema Support**: Generate modules for multiple GraphQL schemas in a single run
- **Type Safety**: Full TypeScript type generation from GraphQL schema
- **Custom Scalars**: Support for custom scalar type definitions
- **Error Handling**: Type-safe error handling using neverthrow

## Related Packages

- [@soda-gql/cli](../cli) - Command-line interface (recommended for most users)
- [@soda-gql/config](../config) - Configuration management
- [@soda-gql/core](../core) - Core types and utilities

## License

MIT
