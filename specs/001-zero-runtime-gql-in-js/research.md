# Research Document: Zero-runtime GraphQL Query Generation

## Executive Summary
The soda-gql platform will deliver a staged migration from runtime GraphQL document generation (for rapid feature development and testing) to a zero-runtime pipeline powered by static analysis and build-time code transformation. Key decisions balance immediate developer ergonomics with long-term performance, type safety, and constitution compliance (Bun + TypeScript, neverthrow, zod).

## Staged Delivery Strategy

### Decision: Two-phase Runtime → Zero-runtime Rollout
- **Rationale**: Runtime generation unlocks fast iteration, integration testing, and validates core abstractions before investing in static analysis plumbing. It also enables CLI/plug-in consumers to exercise the API without bespoke tooling.
- **Alternatives Considered**:
  - _Zero-runtime only_: High upfront cost, limited feedback loop, hard to debug early issues.
  - _Keep runtime permanently_: Violates zero-runtime requirement, adds bundle weight.

### Decision: Shared Builder Pipeline for Both Modes
- **Rationale**: Implement GraphQL Document Generation once inside `packages/builder` and call it from runtime (direct execution) and static analysis (code transform) paths. Ensures parity and reduces divergence.
- **Alternatives Considered**: Separate runtime builder vs static builder → risk of mismatch and duplicated maintenance.

## Core Technology Choices

### TypeScript + Bun Toolchain
- **Decision**: Use Bun 1.x with TypeScript 5.x strict mode for CLI, builder, and plugin execution.
- **Rationale**: Constitution mandates Bun; Bun offers native TypeScript bundling, fast execution, realistic production parity.
- **Alternatives**: Node.js (non-compliant), Deno (immature plugin ecosystem).

### AST & Static Analysis Infrastructure
- **Decision**: Leverage the TypeScript Compiler API for static analysis, with Babel parser support limited to plugin integration.
- **Rationale**: TypeScript AST retains type metadata needed to enforce model/query slice contracts; integrates with existing tooling; matches PandaCSS precedent.
- **Alternatives**: Babel-only (no type info), swc (less ergonomic, limited docs), custom parser (reinventing wheel).

### Error Handling & Validation
- **Decision**: Wrap all fallible operations in neverthrow `Result`, validate external inputs (schema JSON, config) via zod v4.
- **Rationale**: Preserves type information, aligns with constitution; allows deterministic error propagation to CLI/IDE.
- **Alternatives**: try/catch (type loss), fp-ts Either (heavier abstraction), manual validation (error-prone).

## Domain Decisions

### Identifier Strategy for Dependency Resolution
- **Decision**: Use canonical identifiers `{absPath}::{exportName}::{propName}` for models and slices; expose helpers to create/consume IDs.
- **Rationale**: Matches user requirements; enables deterministic cross-file linking during static analysis and runtime generation.
- **Alternatives**: AST node hashes (unstable), relative paths (ambiguous with index exports).

### Lazy Reference Execution Model
- **Decision**: Store model/slice definitions as nullary arrow functions inside a `refs` map to avoid temporal dead zones.
- **Rationale**: Satisfies requirement that `refs[id]()` defers evaluation until dependencies ready; works in runtime and generated script.
- **Alternatives**: Direct object references (ordering hazards), Proxy-based resolution (complex, harder to statically emit).

### Document Registry Deduplication
- **Decision**: Maintain `docs` map keyed by GraphQL document name, error on duplicates, emit JSON artifact consumed by transformers.
- **Rationale**: Enforces uniqueness, simplifies plugin consumption, meets spec scenario (single registration per doc).
- **Alternatives**: Hash-based deduping (harder to debug collisions), multi-file outputs (increases IO complexity).

## Builder Responsibilities

| Stage | Responsibilities | Notes |
|-------|------------------|-------|
| Static Analysis | Parse files, detect soda-gql usage, collect dependency graph | Implemented via build tool APIs (Babel first) |
| GraphQL Document Generation | Execute resolved refs to produce documents | Shared by runtime + zero-runtime |
| Code Transform | Rewrite source to import generated docs | Plugin-specific; builder supplies artifacts |

## Package Roles

- `packages/core`: `createGql` factory, utilities for models, query slices, runtime adapters.
- `packages/builder`: Document generation engine + dependency resolver, CLI entry (`bun run soda-gql builder`).
- `packages/codegen`: Schema ingestion, type generation, emission of `graphql-system` module, CLI command `soda-gql codegen`.
- `packages/plugin-babel`: Build-tool integration; consumes builder artifacts to rewrite code to zero-runtime form.

## Testing Strategy (t_wada)

| Layer | Purpose | Example Failing Test (RED) |
|-------|---------|----------------------------|
| Contract | CLI commands input/output | `codegen` rejects schema without valid SDL path |
| Integration | Builder pipeline merges slices | Combined page query deduplicates fields |
| E2E | Plugin transforms TypeScript file | Import replaced with generated `@/graphql-system` reference |
| Unit | Pure utilities (`resolveRefs`, `mergeArguments`) | Error on missing required parameter |

## Observability & Diagnostics

- Structured JSON logs with context (`stage`, `file`, `identifier`).
- Builder emits summary reports (counts of docs, models, slices) to aid debugging.
- CLI returns non-zero exit codes with neverthrow error messages.

## Performance Considerations

- Cache schema metadata and intermediate dependency graphs in memory during build.
- Batch file analysis where possible; rely on Bun streaming FS APIs.
- Provide perf guard (warn at ≥16 slices, fail at >32) to match requirement.

## Outstanding Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Circular dependencies between models | Detect cycles in graph, emit descriptive error, suggest refactor |
| Conflicting field selections | Merge via schema-aware reconciler; fail fast on incompatible transforms |
| Parameter injection misuse | zod-validate inputs; ensure type signatures enforce required params |
| Schema drift | CLI re-emit triggers type errors; document migration flow |

## Conclusion
All clarifications from the feature specification and user timeline have been addressed. The staged runtime→zero-runtime strategy, shared builder, and strict type/validation rules position the team to begin detailed design (Phase 1) and subsequent task planning.
