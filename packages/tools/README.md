# @soda-gql/tools

Consolidated development tools for soda-gql: CLI, code generation, type generation, and formatting.

## Installation

```bash
bun add -D @soda-gql/tools
```

## Subpath Exports

This package exposes functionality through subpath exports (no root `"."` export):

| Export | Description |
|--------|-------------|
| `@soda-gql/tools/codegen` | GraphQL schema code generation |
| `@soda-gql/tools/typegen` | Prebuilt type generation from tagged templates |
| `@soda-gql/tools/formatter` | GraphQL field selection formatting |

## CLI Binary

The `soda-gql` CLI binary is provided by this package:

```bash
# Generate typed runtime entry from schema
bun run soda-gql codegen schema

# Generate prebuilt types
bun run soda-gql typegen

# Format field selections
bun run soda-gql format

# Run diagnostics
bun run soda-gql doctor
```

## Migration from Previous Packages

This package consolidates several previously separate packages. If upgrading from an earlier version:

| Before | After |
|--------|-------|
| `@soda-gql/cli` | `@soda-gql/tools` (CLI binary) |
| `@soda-gql/codegen` | `@soda-gql/tools/codegen` |
| `@soda-gql/typegen` | `@soda-gql/tools/typegen` |
| `@soda-gql/formatter` | `@soda-gql/tools/formatter` |
| `@soda-gql/runtime` | `@soda-gql/core/runtime` |

### Update Steps

1. Remove old packages and install `@soda-gql/tools`:
   ```bash
   bun remove @soda-gql/cli @soda-gql/codegen @soda-gql/typegen @soda-gql/formatter @soda-gql/runtime
   bun add -D @soda-gql/tools
   ```

2. Update imports:
   ```ts
   // Before
   import { generate } from "@soda-gql/codegen";
   import { createRegistry } from "@soda-gql/runtime";

   // After
   import { generate } from "@soda-gql/tools/codegen";
   import { createRegistry } from "@soda-gql/core/runtime";
   ```

## License

MIT
