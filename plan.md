# Implementation Plan: Zero-runtime GraphQL Query Generation System (Builder + Plugin Alignment)

**Branch**: `001-zero-runtime-gql-in-js`  
**Updated**: 2025-09-24  
**Spec**: `/specs/001-zero-runtime-gql-in-js/spec.md`

## Summary
The core builder pipeline now emits placeholder runtime modules, canonical dependency graphs, and cache metadata via SWC-driven analysis. Tests for analyzer, resolver, caching, and builder CLI flows are green. The next push focuses on aligning the Babel-based transform pipeline with the zero-runtime builder outputs so application code receives pre-built GraphQL documents without shipping transformation logic to production.

## Current Snapshot (2025-09-24)
- **Runtime module generation**: `packages/builder/src/runtime-module.ts` injects placeholder functions for `gql.model` and `gql.querySlice` resolver transforms to enforce zero-runtime semantics.
- **Analyzers**: TypeScript and SWC analyzers share parity, with SWC falling back to TS when the entry expression is not `gql.*`.
- **Dependency graph**: Graph nodes capture references and canonical dependencies, enabling deterministic rewrites and cache reuse.
- **Builder CLI**: Full `bun test` suite passes; cache/integration tests confirm runtime module scaffolding.
- **Gaps**: Babel plugin currently only rewrites `gql.query` calls, injects unused imports, and cannot expose generated documents/transformers to consuming apps. Intermediate file generation still depends on TypeScript AST APIs, preventing a consistent SWC-based build path.

## Key Problems To Solve
- Expand transform coverage so `gql.model`, `gql.querySlice`, and `gql.query` all produce zero-runtime outputs that align with builder metadata.
- Provide a coherent runtime-facing module surface (documents, transformers, helpers) without dangling placeholder imports.
- Replace TypeScript-only AST emission paths with SWC equivalents to keep the pipeline consistent and faster.
- Follow through on CLI/reporting polish (watch mode, metrics) once core transforms land.

## Implementation Roadmap
1. **Plugin Coverage & Contracts**
   - Extend Babel plugin detection and rewrite logic to handle `gql.model` definitions (third argument) and `gql.querySlice` resolvers in step with builder-produced runtime modules.
   - Align plugin output with builder manifests so canonical IDs resolve to emitted GraphQL documents.
   - Add integration tests ensuring all three `gql.*` entry points produce zero-runtime code with no runtime `gql` calls left behind.

2. **Runtime Export Packaging**
   - Refactor builder emission to expose generated GraphQL documents, transformers, and metadata via explicit imports (`@/graphql-system` or generated runtime module).
   - Prune superfluous imports from transformed application files; ensure generated bindings map cleanly onto runtime exports.
   - Validate with smoke fixtures that applications can import the generated documents/functions without referencing builder internals.

### Runtime Export Surface Sketch (2025-09-24)
- Builder runtime modules emit stable named exports per canonical ID alongside aggregated `models`, `slices`, and `operations` maps. Each export uses the sanitized export name plus an 8-character hash of the canonical ID (e.g., `userSliceCatalog.byId` → `userSliceCatalog_byId_a1b2c3d4`) to avoid collisions across modules.
- Operations expose `{ document, variables, transform }` tuples; slices expose `{ invoke, document }` bindings; models expose `{ fragment, transform }` helpers. Each named export proxies the corresponding entry in the aggregated map to keep imports ergonomic, and companion `...Document` bindings surface GraphQL document nodes.
- Generated modules also re-export compiled GraphQL documents under `Document` suffixes (e.g., `ProfilePageQueryDocument`) to support tooling that needs raw documents.
- Babel plugin will import these named bindings (defaulting to `@/graphql-system/runtime` unless overridden) and rewrite `gql.*` call sites to reference the generated exports, removing the original `gql` import when no runtime helpers remain.

3. **SWC-based Artifact Generation**
   - Re-implement intermediate artifact writers currently relying on the TypeScript compiler API using SWC transforms.
   - Guarantee emitted files are executable JavaScript (strip TS syntax) to unblock non-Bun consumers and satisfy T021 follow-up.
   - Benchmark SWC generation to confirm parity with existing TS path.

4. **CLI & Reporting Enhancements**
   - Complete watch-mode reuse, cache logging, and zod-validated option handling (T012/T022).
   - Introduce human-readable reporters with metrics and slice-count warnings (T013/T019) once transform outputs stabilise.

5. **Integration, Docs, and Validation**
   - Wire codegen ↔ builder binaries (T014–T016) using updated transform outputs.
   - Refresh documentation and validation artefacts (T017–T020) to describe the unified zero-runtime workflow.

## Dependencies & Notes
- Plugin coverage (Step 1) must land before runtime export packaging and SWC artifact generation can be finalised.
- SWC artifact work should coordinate with T021 to keep emitted runtime modules consumable without Bun's TS loader.
- Continue enforcing neverthrow-based error handling and Zod validation for external inputs.
- Maintain strict TDD: add or update tests before implementing each roadmap item.

---
This plan realigns the next iteration around closing the zero-runtime gap between builder outputs and the Babel transform layer, while preserving the existing analyzer and cache foundation.
