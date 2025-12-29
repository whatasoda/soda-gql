# @soda-gql/cli

[![npm version](https://img.shields.io/npm/v/@soda-gql/cli.svg)](https://www.npmjs.com/package/@soda-gql/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Command-line interface for soda-gql zero-runtime GraphQL code generation.

## Installation

```bash
bun add -D @soda-gql/cli @soda-gql/config
```

## Usage

### Configuration

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

### Commands

#### Generate GraphQL System

```bash
bun run soda-gql codegen
```

This command:
1. Reads your GraphQL schema
2. Generates type-safe GraphQL system module
3. Outputs to the directory specified in `outdir`

#### Scaffold Templates

For first-time setup, generate inject template with scalar and adapter definitions:

```bash
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to config file (auto-discovered if not specified) |
| `--emit-inject-template <path>` | Generate scaffold template for scalars and adapter definitions |
| `--format <type>` | Output format: `human` (default) or `json` |

### Config File Discovery

The CLI automatically searches for configuration files in the following order:
1. `soda-gql.config.ts`
2. `soda-gql.config.mts`
3. `soda-gql.config.js`
4. `soda-gql.config.mjs`

## Example Workflow

```bash
# 1. Install dependencies
bun add @soda-gql/core @soda-gql/runtime
bun add -D @soda-gql/cli @soda-gql/config

# 2. Create config file
cat > soda-gql.config.ts << 'EOF'
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
EOF

# 3. Generate templates (first-time only)
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts

# 4. Generate GraphQL system
bun run soda-gql codegen
```

## Related Packages

- [@soda-gql/config](../config) - Configuration management
- [@soda-gql/codegen](../codegen) - Code generation engine
- [@soda-gql/core](../core) - Core types and utilities

## License

MIT
