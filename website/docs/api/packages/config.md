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
      inject: "./src/graphql-system/default.inject.ts",
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
| `inject` | `string` | Path to inject file (scalars and adapter definitions) |
| `defaultInputDepth` | `number` | Depth limit for recursive input types (default: `3`, max: `10`) |
| `inputDepthOverrides` | `Record<string, number>` | Per-type depth overrides for specific input types |
| `typeFilter` | `function \| object` | Filter configuration to exclude types from codegen output |

### Recursive Input Type Handling

For schemas with self-referential input types (like Hasura's `bool_exp` pattern), configure depth limits to prevent infinite type inference:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./src/graphql-system/default.inject.ts",
      defaultInputDepth: 3,  // Default depth for all input types
      inputDepthOverrides: {
        // Override for specific recursive types
        user_bool_exp: 5,
        post_bool_exp: 5,
      },
    },
  },
});
```

**When to use**:
- Hasura GraphQL schemas with `*_bool_exp` types
- Any schema with self-referential input types (e.g., `_and`, `_or`, `_not` fields)

**Default behavior**:
- `defaultInputDepth`: `3` (types nested deeper than 3 levels become `never`)
- `inputDepthOverrides`: `{}` (no per-type overrides)

### Type Filtering

For schemas with many auto-generated types (like Hasura's aggregate types), configure type filters to exclude unwanted types from codegen output:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./src/graphql-system/default.inject.ts",
      typeFilter: {
        exclude: [
          { pattern: "*_stddev_*", category: "input" },
          { pattern: "*_variance_*", category: "input" },
        ],
      },
    },
  },
});
```

**Function-based filtering** for more complex logic:

```typescript
typeFilter: ({ name, category }) => {
  // Return true to include, false to exclude
  if (category !== "input") return true;
  return !name.includes("_stddev_") && !name.includes("_variance_");
},
```

**When to use**:
- Hasura GraphQL schemas with many aggregate input types (`*_stddev_*`, `*_variance_*`, etc.)
- Large schemas where unused types slow down codegen or bloat output

**Filter rule options**:
- `pattern`: Glob pattern to match type names (e.g., `"*_stddev_*"`)
- `category`: Optional filter by type category (`"object"`, `"input"`, `"enum"`, `"union"`, `"scalar"`)

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
      inject: "./src/graphql-system/users.inject.ts",
    },
    products: {
      schema: "./schemas/products.graphql",
      inject: "./src/graphql-system/products.inject.ts",
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
