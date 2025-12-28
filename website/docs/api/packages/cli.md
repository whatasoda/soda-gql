# @soda-gql/cli

Command-line interface for soda-gql code generation.

:::warning Work in Progress
This documentation is being developed.
:::

## Installation

```bash
bun add -D @soda-gql/cli
```

## Commands

### `codegen`

Generate the type-safe GraphQL system from your schema:

```bash
bun run soda-gql codegen
```

#### Options

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to config file (default: `soda-gql.config.ts`) |
| `--emit-inject-template <path>` | Generate scalar/adapter template file |

### `builder`

Generate runtime artifacts during development:

```bash
bun run soda-gql builder --mode runtime --entry ./src/**/*.ts --out ./.cache/soda-gql/runtime.json
```

## Configuration

Create a `soda-gql.config.ts` file:

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

## See Also

- [Getting Started](/guide/getting-started) - Setup instructions
- [@soda-gql/config](/api/packages/config) - Configuration options
