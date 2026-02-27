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

#### Subcommand: `codegen graphql`

Generate TypeScript compat code from existing `.graphql` operation files:

```bash
bun run soda-gql codegen graphql --input "src/**/*.graphql" --output src/generated
```

This is useful for:
- Migrating existing GraphQL operations to soda-gql
- Teams preferring to write operations in `.graphql` files
- Gradual adoption of the soda-gql type-safe API

**Options:**

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to config file |
| `--schema <name>` | Schema name (required if multiple schemas configured) |
| `--input <glob>` | Glob pattern for .graphql files (repeatable) |
| `--output <dir>` | Output directory for generated files |

**Example:**

Given `src/queries/GetUser.graphql`:

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
  }
}
```

Running:

```bash
bun run soda-gql codegen graphql --input "src/queries/*.graphql" --output src/generated
```

Generates `src/generated/GetUser.compat.ts`:

```typescript
import { gql } from "../graphql-system";

export const GetUserCompat = gql.default(({ query, $var }) =>
  query.compat({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

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
