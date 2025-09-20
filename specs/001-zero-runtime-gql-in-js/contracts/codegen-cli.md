# Contract — `soda-gql codegen`

## Purpose
Generate the `graphql-system` runtime module by consuming a GraphQL schema and emitting the strongly typed helper bundle (`createHelpers`, `createRefFactories`, `model`, `querySlice`, `query`, etc.) that mirrors the usage demonstrated in `packages/core/src/__tests__/types/debug.test.ts`.

## Inputs
| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--schema` | Path (file) | ✅ | SDL or introspection JSON file validated via zod |
| `--out` | Path (file) | ✅ | Target TypeScript module path (e.g., `packages/graphql-system/src/index.ts`) |
| `--format` | Enum (`json` \| `human`) | ❌ (default `human`) | Output format for CLI diagnostics |
| `--watch` | Boolean | ❌ | Re-run codegen on schema changes |
| `--help` / `--version` | Boolean | ❌ | Standard Bun CLI flags |

## Successful Response (GREEN)
- Exit code `0`.
- Writes the target module exporting a default `gql` object that aggregates:
  - Schema helpers (`createHelpers<Schema>` output) scoped to the provided schema.
  - Reference factories produced via `createRefFactories<Schema>()`.
  - Runtime-bound factories (`gql.model`, `gql.querySlice`, `gql.query`, `gql.mutation`, `gql.subscription`).
- Injects the serialised schema description required by downstream builders.
- Emits diagnostics (JSON or human readable) including:
  - Number of object/union/input definitions processed.
  - Hash of schema input for cache invalidation.

## Failure Cases (RED)
| Scenario | Expected Behavior |
|----------|------------------|
| Missing schema file | Exit `1`; JSON error `{ code: "SCHEMA_NOT_FOUND", path }` |
| Invalid schema (fails zod validation) | Exit `1`; message `SchemaValidationError` with details |
| Output directory not writable | Exit `1`; suggestion to re-run with proper permissions |
| Watch mode + schema parse error | Keep process alive, emit error event without writing partial output |

## Contract Tests (to be written)
1. `codegen_schema_missing.test.ts` → Expect `Result.err` with `SCHEMA_NOT_FOUND`.  
2. `codegen_invalid_schema.test.ts` → Provide malformed SDL, expect validation error pointing to line/column.  
3. `codegen_success_snapshot.test.ts` → For sample schema, ensure emitted module matches approved snapshot (GREEN when impl ready).

## Dependencies
- `packages/codegen` (CLI implementation)
- `packages/core` (`createGql` types for injection)
- `neverthrow`, `zod` for validation & errors
