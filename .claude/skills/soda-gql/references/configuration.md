# Configuration Reference

Complete configuration options for soda-gql.

## Configuration File

Create `soda-gql.config.ts` in your project root:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  // Configuration options
});
```

## Configuration Options

### outdir

**Type:** `string`
**Required:** Yes

Output directory for generated GraphQL system files.

```typescript
outdir: "./src/graphql-system"
```

### include

**Type:** `string[]`
**Required:** Yes

Glob patterns for files to analyze for `gql.default()` calls.

```typescript
include: ["./src/**/*.ts", "./src/**/*.tsx"]
```

### exclude

**Type:** `string[]`
**Required:** No

Glob patterns for files to exclude from analysis.

```typescript
exclude: ["./src/**/*.test.ts", "./src/**/*.spec.ts"]
```

### schemas

**Type:** `Record<string, SchemaConfig>`
**Required:** Yes

Schema configurations. Each key becomes the schema name used in code (`gql.{schemaName}`).

```typescript
schemas: {
  default: {
    schema: "./schema.graphql",
    inject: "./src/graphql-system/default.inject.ts",
  },
}
```

### analyzer

**Type:** `"ts" | "swc"`
**Required:** No
**Default:** `"ts"`

Static analyzer to use for finding `gql.default()` calls.

- `"ts"`: TypeScript-based analyzer (more accurate)
- `"swc"`: SWC-based analyzer (faster)

```typescript
analyzer: "ts"
```

### graphqlSystemAliases

**Type:** `string[]`
**Required:** No

Additional import aliases for the GraphQL system module. Useful when using multiple path aliases.

```typescript
graphqlSystemAliases: ["@/graphql", "~/gql"]
```

### styles

**Type:** `StylesConfig`
**Required:** No

Code generation style options.

```typescript
styles: {
  importExtension: ".js",  // ESM import extensions
}
```

## Schema Configuration

### schema

**Type:** `string`
**Required:** Yes

Path to the GraphQL schema file (.graphql or .json).

```typescript
schema: "./schema.graphql"
```

Supports:
- SDL files (`.graphql`, `.gql`)
- Introspection JSON files (`.json`)

### inject

**Type:** `string | InjectConfig`
**Required:** Yes

Path to inject file or inject configuration object.

**Simple path:**
```typescript
inject: "./src/graphql-system/default.inject.ts"
```

**Object configuration:**
```typescript
inject: {
  scalars: "./src/graphql-system/default.inject.ts",
  adapter: "./src/graphql-system/adapter.ts",  // Optional
}
```

## Multi-Schema Configuration

Configure multiple GraphQL schemas:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    // Main API
    default: {
      schema: "./schemas/main.graphql",
      inject: "./src/graphql-system/default.inject.ts",
    },
    // Admin API
    admin: {
      schema: "./schemas/admin.graphql",
      inject: "./src/graphql-system/admin.inject.ts",
    },
    // Third-party API
    external: {
      schema: "./schemas/external.graphql",
      inject: "./src/graphql-system/external.inject.ts",
    },
  },
});
```

**Usage in code:**

```typescript
import { gql } from "@/graphql-system";

// Default schema
const mainQuery = gql.default(/* ... */);

// Admin schema
const adminQuery = gql.admin(/* ... */);

// External schema
const externalQuery = gql.external(/* ... */);
```

## TypeScript Path Configuration

Configure TypeScript paths to match your `outdir`:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/graphql-system": ["./src/graphql-system"],
      "@/graphql-system/*": ["./src/graphql-system/*"]
    }
  }
}
```

## Complete Example

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  // Output directory
  outdir: "./src/graphql-system",

  // Files to analyze
  include: ["./src/**/*.ts", "./src/**/*.tsx"],
  exclude: ["./src/**/*.test.ts", "./src/**/*.d.ts"],

  // Schema configurations
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: {
        scalars: "./src/graphql-system/default.inject.ts",
        adapter: "./src/graphql-system/adapter.ts",
      },
    },
  },

  // Options
  analyzer: "ts",
  graphqlSystemAliases: ["@/gql"],
  styles: {
    importExtension: ".js",
  },
});
```

## Environment-Specific Configuration

Use environment variables or conditional logic:

```typescript
import { defineConfig } from "@soda-gql/config";

const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: isDev ? "./schema.dev.graphql" : "./schema.graphql",
      inject: "./src/graphql-system/default.inject.ts",
    },
  },
});
```
