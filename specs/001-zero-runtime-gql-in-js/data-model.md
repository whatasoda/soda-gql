# Data Model — Zero-runtime GraphQL Query Generation

The ecosystem revolves around a generated `gql` helper bundle (from `codegen`), user-authored model/slice/operation definitions that rely on the `packages/core/src/types` DSL, and a builder pipeline that evaluates those definitions to produce artifacts consumed by runtime tests and zero-runtime transforms. All components share canonical identifiers in the form `{absoluteFilePath}::{exportName}` so dependencies can be tracked deterministically.

## Core Artifacts

| Artifact | Producer | Structure | Consumers |
|----------|----------|-----------|-----------|
| `graphql-system` module | `soda-gql codegen` | Exports `gql` object containing `createHelpers`, `createRefFactories`, and the runtime factories (`model`, `querySlice`, `query`, `mutation`, `subscription`) specialised on the imported schema. | Application code, builder pipeline |
| Builder artifact JSON | `soda-gql builder` | `{ documents: Record<DocumentName, DocumentEntry>, refs: Record<CanonicalIdentifier, RefEntry>, report: BuilderReport }` | Babel plugin, future build integrations |
| Generated documents | Builder pipeline | GraphQL text + variable metadata per operation | Runtime execution, snapshot tests |

## Entity Glossary

### Schema Description (`AnyGraphqlSchema`)
- **Fields**: scalar/enums/inputs/objects/unions defined via the `define()` helper in `packages/core/src/types/schema.ts`.
- **Invariants**: Must include the operation root names under `schema.query`, `schema.mutation`, `schema.subscription`. Objects are augmented with an implicit `__typename` field.
- **Usage**: Codegen imports SDL/JSON, emits a literal object satisfying `AnyGraphqlSchema`, and passes it to `createHelpers<Schema>(schema)` and `createRefFactories<Schema>()`.

### `gql` Helper Bundle
- **Shape**: `{ ...createHelpers<Schema>, ...createRefFactories<Schema>(), model: ModelFn<Schema>, querySlice: OperationSliceFn<Schema, Adapter, "query">, query: OperationFn<Schema, Adapter, "query">, ... }`.
- **Dependencies**: Requires an adapter implementing `GraphqlRuntimeAdapter` with `nonGraphqlErrorType`. Adapter is generated per project so transformations can surface framework-specific errors.
- **Guarantees**: Each factory is already generic over the loaded schema; no additional type parameters needed in user modules.

### ModelDefinition (`ModelFn` result)
- **Fields**:
  - `typename: keyof Schema["object"]` (string literal)
  - `variables: Record<string, InputDefinition>` (possibly empty)
  - `fragment(variables) => AnyFields`: returns the field selection tree built via `FieldsBuilder`
  - `transform(selected) => DomainModel`: synchronous pure function using type inferred from `InferFields`
- **Invariants**:
  - Declared at module top-level to allow static analysis.
  - Transform must be referentially transparent (no side effects) and return plain objects or `neverthrow` results, depending on design (we expect plain objects now, zero-runtime will wrap later).
  - `fragment` accepts either variable references from `$` tools or literal values when invoked inside builder-generated script.

### OperationSliceDefinition (`OperationSliceFn` result)
- **Fields**:
  - `operation: "query" | "mutation" | "subscription"`
  - `object: AnyFields` representing the selection on the operation root object.
  - `transform({ prefix, results }) => SelectionProjection`: uses `SliceResult` wrappers from adapters to produce domain structures.
- **Invariants**:
  - Accepts a tuple `[variables?]` when defined; invocation requires providing either `VoidIfEmptyObject<TVariables>` or typed variable references.
  - Selection builder must only reference models/slices that can be statically resolved.
  - Transform must handle all three `SliceResult` variants (`isError`, `isEmpty`, `safeUnwrap`).

### OperationDefinition (`OperationFn` result)
- **Fields**:
  - `name: string` (document name, unique per artifact)
  - `document: DocumentNode` (populated by builder)
  - `transform(data: unknown) => Record<string, SliceProjection>` (delegates to composed slices)
- **Invariants**:
  - Builder ensures variables map matches the declared signature.
  - Slices can be invoked multiple times (deduped during builder evaluation).

### Canonical Identifier
- **Type**: branded string produced as `{absPath}::{exportName}` (optionally extended with property paths for nested definitions in future).
- **Usage**: Keys into `refs` map inside the builder artifact; ensures uniqueness across the workspace.

### Builder Pipeline
- **Stages**:
  1. **Discover**: Static analysis enumerates modules importing `@/graphql-system`, extracts exported models/slices/operations.
  2. **Load**: Executes a generated script that imports the user modules and registers entries into a `refs` registry shaped as `{ [id]: () => OperationSlice | ModelDefinition | OperationDefinition }`.
  3. **Evaluate**: Lazily invokes refs in dependency order, building `documents` and structured transform metadata.
  4. **Emit**: Writes JSON artifact with diagnostics (counts, duration, warnings for ≥16 slices, errors for >32).
- **Error Surfaces**: Cycle detection, duplicate document names, missing variables, runtime throws with error types defined by `GraphqlRuntimeAdapter.nonGraphqlErrorType`.

### Builder Artifact JSON
- **documents**: `{ [documentName: string]: { text: string; variables: Record<string, string>; sourceMap?: SourceMapPayload } }`
- **refs**: Mixed map (`model` | `slice` | `operation` kinds). Model entries include hashes for cache invalidation; slice entries point to `canonicalDocument` for cross-referencing.
- **report**: `{ documents: number; models: number; slices: number; durationMs: number; warnings: string[] }`

### Plugin Input (`@soda-gql/plugin-babel`)
- **Fields**: `{ mode: "runtime" | "zero-runtime"; artifactsPath: string; importIdentifier: string; diagnostics: "json" | "console" }`
- **Responsibilities**:
  - Load builder artifact (validated with zod v4).
  - For `zero-runtime`, rewrite `gql.query`/`gql.mutation`/`gql.subscription` calls to direct imports from `@/graphql-system` using artifact lookups.
  - Leave `gql.model` and `gql.querySlice` definitions untouched (they are consumed during builder execution).

### CLI Contracts
- **Codegen (`soda-gql codegen`)**:
  - Validates schema input, emits `graphql-system` TypeScript module, outputs diagnostics with schema hash.
  - Must produce Bun/Biome compatible ESM output and include adapter scaffolding.
- **Builder (`soda-gql builder`)**:
  - Accepts `--mode`, `--entry`, `--out`, `--format`, `--watch`.
  - Emits artifact and logs warnings/errors as structured data (neverthrow results surfaced as non-zero exit codes).

## Data Flow Summary

```mermaid
digraph {
  schema [label="Schema SDL/JSON", shape=folder]
  codegen [label="soda-gql codegen\n(generates gql bundle)", shape=box]
  gqlmod [label="@/graphql-system\n(gql helpers)", shape=box]
  user [label="User Models/Slices/Operations", shape=component]
  builder [label="soda-gql builder\n(runtime + artifact)", shape=parallelogram]
  artifact [label="builder artifact JSON", shape=note]
  plugin [label="@soda-gql/plugin-babel", shape=box]

  schema -> codegen -> gqlmod -> user
  user -> builder -> artifact -> plugin
  builder -> gqlmod [label="runtime doc eval"]
}
```

## Validation & Safety
- **Type Safety**: All helper types are generic over a concrete `Schema`; no `any`/`unknown` leaks. Variable references (`VariableReference`) carry brand information so mismatched assignments are compile-time errors.
- **Error Handling**: Every fallible operation returns `Result` (neverthrow). CLI entry points convert these into process exit codes after formatting diagnostics.
- **External Data**: Schema input, builder artifact, and CLI options are validated using zod v4 before execution.
- **Testing Hooks**: Contract tests target CLI behaviour, integration tests execute builder pipelines on sample projects, unit tests cover pure helpers like `FieldsBuilder`, `InferByTypeRef`, and `SliceResult` variants.

## Responsibilities Matrix

| Component | Owns | Reads | Notes |
|-----------|------|-------|-------|
| `packages/codegen` | Schema ingestion, gql bundle emission | SDL/JSON schema, project config | Must remain side-effect free aside from FS writes |
| `packages/core` | Typed DSL (`ModelFn`, `OperationSliceFn`, etc.) | Generated schema module | No runtime IO; serves as compile-time contract |
| `packages/builder` | Dependency resolution, document generation | User code, generated gql bundle | Produces artifacts for runtime + zero-runtime |
| `packages/plugin-babel` | Source rewriting | Builder artifact | Delegates to builder for document creation |
| `packages/graphql-system` | Generated helper bundle | - | Output of codegen, committed or built on install |

This model aligns every stage of the runtime→zero-runtime migration with the concrete type-level constructs already defined under `packages/core/src/types`, ensuring the documentation, contracts, and implementation strategy remain consistent.
