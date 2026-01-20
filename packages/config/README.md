# @soda-gql/config

[![npm version](https://img.shields.io/npm/v/@soda-gql/config.svg)](https://www.npmjs.com/package/@soda-gql/config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Configuration management for soda-gql tooling.

## Installation

```bash
bun add -D @soda-gql/config
```

## Usage

### Basic Configuration

Create a `soda-gql.config.ts` file in your project root:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./src/graphql-system/default.inject.ts",
    },
  },
});
```

### Multi-Schema Configuration

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    users: {
      schema: "./schemas/users.graphql",
      inject: "./src/graphql-system/users/users.inject.ts",
    },
    products: {
      schema: "./schemas/products.graphql",
      inject: "./src/graphql-system/products/products.inject.ts",
    },
  },
});
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `outdir` | `string` | Yes | Output directory for generated GraphQL system |
| `include` | `string[]` | Yes | Glob patterns for files to analyze |
| `exclude` | `string[]` | No | Glob patterns for files to exclude |
| `schemas` | `object` | Yes | Schema configurations (see below) |
| `analyzer` | `"ts" \| "swc"` | No | TypeScript analyzer to use (default: `"ts"`) |
| `graphqlSystemAliases` | `string[]` | No | TSConfig path aliases for GraphQL system imports |
| `styles.importExtension` | `boolean` | No | Include `.js` extensions in generated imports |

### Schema Configuration

Each schema entry requires:

| Option | Type | Description |
|--------|------|-------------|
| `schema` | `string` | Path to GraphQL schema file |
| `inject` | `string \| { scalars: string; adapter?: string }` | Path to inject file or object with separate paths |
| `defaultInputDepth` | `number` | Depth limit for recursive input types (default: `3`, max: `10`) |
| `inputDepthOverrides` | `Record<string, number>` | Per-type depth overrides for specific input types |
| `typeFilter` | `function \| object` | Filter to exclude types from codegen (see below) |

### Type Filtering

Exclude unwanted types from codegen output using pattern-based or function-based filters:

```typescript
typeFilter: {
  exclude: [
    { pattern: "*_stddev_*", category: "input" },
    { pattern: "*_variance_*", category: "input" },
  ],
},
```

Or use a function for complex logic:

```typescript
typeFilter: ({ name, category }) => !name.includes("_stddev_"),
```

## Config File Formats

The following config file formats are supported (searched in order):

1. `soda-gql.config.ts` (recommended)
2. `soda-gql.config.mts`
3. `soda-gql.config.js`
4. `soda-gql.config.mjs`

## API Reference

### `defineConfig(config)`

Type-safe configuration helper:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  // Configuration with full TypeScript support
});
```

### `loadConfig(options?)`

Programmatically load configuration:

```typescript
import { loadConfig } from "@soda-gql/config";

const result = await loadConfig({
  configPath: "./custom-config.ts", // optional
});

if (result.isOk()) {
  console.log(result.value);
}
```

## Related Packages

- [@soda-gql/cli](../cli) - Command-line interface
- [@soda-gql/codegen](../codegen) - Code generation engine

## License

MIT
