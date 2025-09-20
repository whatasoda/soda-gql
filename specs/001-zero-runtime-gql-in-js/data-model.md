# Data Model — Zero-runtime GraphQL Query Generation

## Entity Overview
| Entity | Purpose | Key Relationships |
|--------|---------|-------------------|
| Model | Declarative representation of a GraphQL type | References `FieldSelection`, `TransformFn`, optional parameter schemas |
| QuerySlice | Domain-specific partial query | Depends on Models, contributes to PageQuery |
| PageQuery | Aggregated query built from slices | Owns merged GraphQL Document + variables map |
| BuilderPipeline | Executes dependency resolution + document generation | Consumes Models/Slices registry, outputs docs JSON |
| DocumentRegistry | Stores generated GraphQL documents | Populated by BuilderPipeline, consumed by code transforms |
| CodegenCLI | Generates typed runtime modules (`graphql-system`) | Injects schema metadata into `createGql` factory |
| createGqlContext | Bundles schema-derived types + utilities | Returned to userland for runtime-safe APIs |
| PluginTransform | Build-tool integration (Babel first) | Uses builder outputs to rewrite source files |

## Model
- **Fields**:
  - `id: CanonicalIdentifier` (`{absPath}::{exportName}::{propName}`)
  - `schemaType: GraphQLObjectType | GraphQLInterfaceType`
  - `fields: FieldSelection[]` (each entry includes field name, arguments, nested selection ref)
  - `parameters: z.ZodObject` (optional, validated at injection time)
  - `transform: TransformFn<ResultPayload, ResultPayload>` returning `Result<ModelOutput, TransformError>`
- **Invariants**:
  - Declared at module top-level
  - No external side effects during evaluation
  - Transform must return `Result.ok` for valid data or `Result.err` with structured info

## QuerySlice
- **Fields**:
  - `id: CanonicalIdentifier`
  - `operation: "query" | "mutation"`
  - `rootModel: Model`
  - `arguments: ArgumentDefinition[]` (zod validated)
  - `dependencies: CanonicalIdentifier[]`
  - `compose: (refs: RefResolver) => Result<QueryNode, SliceError>`
- **Invariants**:
  - Accepts injected parameters only via typed arguments
  - Must be pure; no IO or global mutation
  - Registers its contribution name to avoid duplicates

## PageQuery
- **Fields**:
  - `id: CanonicalIdentifier`
  - `slices: QuerySlice[]`
  - `mergedDocument: GraphQLDocument` (builder output)
  - `variableMap: Record<string, ArgumentSource>`
  - `normalize: (input: RawResponse) => Result<PageData, NormalizeError>`
- **Invariants**:
  - Merges slices via deterministic order (topological sort)
  - Fails fast on conflicting selections
  - Maintains stable document naming for registration

## BuilderPipeline
- **Stages**:
  1. `collect`: Traverse sources to discover Models/Slices/PageQueries
  2. `resolve`: Build dependency graph, detect cycles, order execution
  3. `execute`: Evaluate refs lazily, fill `refs`/`docs` objects
  4. `emit`: Produce JSON artifact + diagnostics summary
- **Key Types**:
  - `RefEntry = () => Result<unknown, ResolveError>`
  - `DocEntry = () => Result<GraphQLDocument, GenerationError>`
  - `BuilderReport` (counts, warnings, timings)

## DocumentRegistry
- Maintains `refs: Record<CanonicalIdentifier, RefEntry>` and `docs: Record<DocumentName, DocEntry>`.
- Enforces uniqueness per key; duplicates trigger `Result.err` with pointer to source file/export.
- Provides `evaluateAll()` to materialize docs during runtime mode or zero-runtime build script execution.

## CodegenCLI
- Accepts schema path (SDL/JSON) + configuration via CLI flags (zod validated).
- Generates `packages/graphql-system/src/index.ts` (or configurable target) exporting typed helpers generated via `createGql`.
- Outputs `Result<void, CodegenError>` and structured diagnostics.

## createGqlContext
- Function `createGql({ schema, documents, transforms }): GqlRuntime`
- Injects type-safe utilities (e.g., `gql`, `registerModel`, `useQuery`).
- Interface-driven to enable independent testing per utility before wiring.

## PluginTransform (Babel)
- Entrypoint `sodaGqlBabelPlugin(options)`.
- Hooks into Babel AST traversal to detect soda-gql usage, defers GraphQL document generation to builder (via IPC or shared module).
- Rewrites imports to generated module `@/graphql-system` and inserts doc references.

## Supporting Types
- `CanonicalIdentifier`: branded `string` enforcing format via zod + custom refinement.
- `RefResolver`: `(id: CanonicalIdentifier) => Result<unknown, MissingRefError>`.
- `GraphQLDocument`: object with `name`, `text`, `variables`, `sourceMap` (for debugging + transforms).

## Data Flow Overview
```
Schema (SDL/JSON)
   │
   ▼
CodegenCLI ──▶ graphql-system (generated TS)
   │
   ▼
createGqlContext (core) ⇆ Application Code (models, slices, page queries)
   │                             │
   │                             └─ defines refs/docs via runtime builder
   └──────────────────────────────▶ BuilderPipeline evaluates refs & emits docs JSON
                                      │
                                      ├─ Runtime Mode: executed directly (dev/tests)
                                      └─ Zero-runtime Mode: artifacts consumed by plugin-babel for code transform
```

## Validation & Error Surfaces
- All external IO (schema files, generated artifacts) validated with zod before use.
- neverthrow `Result` wraps every stage; calling code must explicitly handle `ok` / `err`.
- Diagnostics include file path + export identifiers to align with dependency resolution strategy.
