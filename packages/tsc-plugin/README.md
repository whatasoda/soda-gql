# @soda-gql/tsc-plugin

[![npm version](https://img.shields.io/npm/v/@soda-gql/tsc-plugin.svg)](https://www.npmjs.com/package/@soda-gql/tsc-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript compiler plugin for soda-gql zero-runtime GraphQL transformations.

## Installation

```bash
bun add -D @soda-gql/tsc-plugin
```

## Overview

This plugin integrates soda-gql's zero-runtime transformations directly into the TypeScript compiler. It works with:

- NestJS compiler
- ts-patch
- Any TypeScript compiler that supports transformer plugins

## Configuration

### With NestJS

Add the plugin to your `nest-cli.json`:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "tsc",
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@soda-gql/tsc-plugin",
        "options": {
          "configPath": "./soda-gql.config.ts",
          "importIdentifier": "@/graphql-system"
        }
      }
    ]
  }
}
```

### With ts-patch

First, install ts-patch:

```bash
bun add -D ts-patch
npx ts-patch install
```

Then add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@soda-gql/tsc-plugin",
        "configPath": "./soda-gql.config.ts"
      }
    ]
  }
}
```

## Plugin Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `configPath` | `string` | No | Path to soda-gql config file (auto-discovered if not specified) |
| `importIdentifier` | `string` | No | Import identifier for GraphQL system (e.g., `"@/graphql-system"`) |

## How It Works

The plugin transforms `gql.default()` calls at compile time:

**Input:**
```typescript
import { gql } from "@/graphql-system";

export const userQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    { operationName: "GetUser", variables: [$("id").scalar("ID:!")] },
    ({ $ }) => ({ user: userSlice.build({ id: $.id }) }),
  ),
);
```

**Output:**
```typescript
import { gqlRuntime } from "@soda-gql/runtime";

export const userQuery = gqlRuntime.getComposedOperation("canonicalId");
gqlRuntime.composedOperation("canonicalId", { /* compiled operation */ });
```

## Complete NestJS Example

### 1. Project Setup

```bash
# Create new NestJS project
nest new my-app
cd my-app

# Install dependencies
bun add @soda-gql/core @soda-gql/runtime
bun add -D @soda-gql/cli @soda-gql/config @soda-gql/tsc-plugin
```

### 2. Configure soda-gql

Create `soda-gql.config.ts`:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  graphqlSystemAliases: ["@/graphql-system"],
  include: ["./src/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./inject-module/runtime-adapter.ts",
      scalars: "./inject-module/scalars.ts",
    },
  },
});
```

### 3. Configure NestJS

Update `nest-cli.json`:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "tsc",
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@soda-gql/tsc-plugin",
        "options": {
          "configPath": "./soda-gql.config.ts",
          "importIdentifier": "@/graphql-system"
        }
      }
    ]
  }
}
```

### 4. Configure TypeScript Paths (Optional)

If you're using path aliases like `@/graphql-system`, update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/graphql-system": ["./graphql-system"]
    }
  }
}
```

### 5. Generate GraphQL System

```bash
bun run soda-gql codegen
```

### 6. Build and Run

```bash
nest build
nest start
```

## Troubleshooting

### Plugin Not Transforming Code

1. Ensure `configPath` points to a valid config file
2. Verify the GraphQL system is generated (`bun run soda-gql codegen`)
3. Check that `importIdentifier` matches your tsconfig paths

### Type Errors After Transformation

1. Ensure `@soda-gql/runtime` is installed
2. Verify GraphQL system types are up to date
3. Run `bun run soda-gql codegen` to regenerate types

### NestJS Build Errors

1. Verify `nest-cli.json` plugin configuration is correct
2. Ensure `builder` is set to `"tsc"` (not `"swc"` or `"webpack"`)
3. Check for TypeScript version compatibility (requires TypeScript 5.x)

## Related Packages

- [@soda-gql/cli](../cli) - Command-line interface
- [@soda-gql/config](../config) - Configuration management
- [@soda-gql/runtime](../runtime) - Runtime utilities
- [@soda-gql/plugin-babel](../plugin-babel) - Babel transformation plugin

## License

MIT
