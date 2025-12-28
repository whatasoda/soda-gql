# @soda-gql/config

Configuration management for soda-gql tooling. This package provides type-safe configuration helpers and loaders.

## Installation

```bash
bun add -D @soda-gql/config
```

## defineConfig()

Create a type-safe configuration file:

```typescript
// soda-gql.config.ts
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./src/graphql-system/runtime-adapter.ts",
      scalars: "./src/graphql-system/scalars.ts",
    },
  },
});
```

## Configuration Options

### Root Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `outdir` | `string` | Yes | Output directory for generated GraphQL system |
| `include` | `string[]` | Yes | Glob patterns for files to analyze |
| `exclude` | `string[]` | No | Glob patterns for files to exclude |
| `schemas` | `object` | Yes | Schema configurations |
| `analyzer` | `"ts" \| "swc"` | No | TypeScript analyzer (default: `"ts"`) |
| `graphqlSystemAliases` | `string[]` | No | Path aliases for imports |
| `styles.importExtension` | `boolean` | No | Include `.js` extensions |

### Schema Options

Each entry in `schemas` requires:

| Option | Type | Description |
|--------|------|-------------|
| `schema` | `string` | Path to GraphQL schema file |
| `runtimeAdapter` | `string` | Path to runtime adapter module |
| `scalars` | `string` | Path to scalar definitions module |

## Multi-Schema Configuration

Support multiple GraphQL schemas in one project:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    users: {
      schema: "./schemas/users.graphql",
      runtimeAdapter: "./src/graphql-system/users/runtime-adapter.ts",
      scalars: "./src/graphql-system/users/scalars.ts",
    },
    products: {
      schema: "./schemas/products.graphql",
      runtimeAdapter: "./src/graphql-system/products/runtime-adapter.ts",
      scalars: "./src/graphql-system/products/scalars.ts",
    },
  },
});
```

Use different schemas in your code:

```typescript
import { gql } from "@/graphql-system";

// Use the users schema
export const getUserQuery = gql.users(({ query }) => ...);

// Use the products schema
export const getProductQuery = gql.products(({ query }) => ...);
```

## Programmatic Loading

Load configuration programmatically using `loadConfig`:

```typescript
import { loadConfig } from "@soda-gql/config";

const result = await loadConfig();

if (result.isOk()) {
  const config = result.value;
  console.log(config.outdir);
  console.log(Object.keys(config.schemas));
} else {
  console.error(result.error);
}
```

### Load Options

```typescript
await loadConfig({
  configPath: "./custom-config.ts",  // Custom config file path
});
```

## Config File Formats

Supported formats (searched in order):

1. `soda-gql.config.ts` (recommended)
2. `soda-gql.config.mts`
3. `soda-gql.config.js`
4. `soda-gql.config.mjs`

## Error Handling

Configuration errors are returned as `Result` types using [neverthrow](https://github.com/supermacro/neverthrow):

```typescript
import { loadConfig } from "@soda-gql/config";

const result = await loadConfig();

result.match(
  (config) => {
    // Success: use config
  },
  (error) => {
    // Error: handle ConfigError
    console.error(error.code, error.message);
  },
);
```

### Error Codes

| Code | Description |
|------|-------------|
| `CONFIG_NOT_FOUND` | No config file found |
| `CONFIG_PARSE_ERROR` | Failed to parse config file |
| `VALIDATION_ERROR` | Config validation failed |
