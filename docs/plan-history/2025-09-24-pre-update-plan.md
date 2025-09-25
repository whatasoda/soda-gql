# Implementation Plan: Zero-runtime GraphQL Query Generation System (Builder Rework)

**Branch**: `001-zero-runtime-gql-in-js`  
**Updated**: 2025-09-23  
**Spec**: `/specs/001-zero-runtime-gql-in-js/spec.md`

## Summary
The project delivers a zero-runtime GraphQL query generation workflow inspired by PandaCSS. Runtime code uses typed `gql.*` helpers authored in TypeScript; build-time tooling performs static analysis, resolves dependencies, and emits executable GraphQL documents plus manifests consumed by upcoming build plugins. Codegen + core runtime foundations already exist. This revision realigns the builder package toward an AST-driven, high-performance pipeline that keeps future plugins lightweight while enabling cacheable zero-runtime transformations.

## Current Snapshot (2025-09-23)
- **Codegen package**: Generates `@/graphql-system` artifacts; working via CLI contract tests.  
- **Core package**: Provides `gql.model`, `gql.querySlice`, `gql.query`, and document builders with neverthrow-based APIs.  
- **Builder package**: Prototype uses RegExp-based discovery, only registers empty documents, lacks execution, hashing, or caching.  
- **Plugin/CLI**: Stubs exist; expect builder artifacts to drive future zero-runtime transforms.

## Builder Rework Goals
- Replace RegExp discovery with SWC-powered AST traversal to locate `gql.model`, `gql.querySlice`, and `gql.query` definitions, capturing source locations and canonical identifiers.
- Keep builder core abstract; concrete document materialisation logic lives in thin plugins/extensions.
- Minimise runtime cost by caching parse + evaluation artifacts keyed by file content hash (Bun `hash`), supporting watch mode and reruns.
- Emit rich metadata (refs, dependency graph, document registry) compatible with zero-runtime transform and runtime execution modes.
- Respect architectural constraints: definitions at module top-level; canonical IDs of the form `{absPath}::{exportName}::{propertyName?}`; no reliance on `specs/` imports; neverthrow for errors; no thrown exceptions in expected flows.

## Guardrails & Assumptions
- Analyzer treats data outside `data-transformer` as pure; safe to execute definitions once dependencies resolved.
- File resolution must account for barrel/index re-exports and path aliases resolved via TypeScript compiler options (tsconfig paths + Bun resolution).
- Builder will execute within Bun runtime; prefer Bun APIs (`Bun.file`, `Bun.hash`, `Bun.watch`) over Node equivalents.
- Zod validates external inputs (CLI args, config JSON); internal data structures rely on TypeScript types.

## Implementation Roadmap
1. **Stage A — SWC Foundation & Infrastructure**
   - Add `@swc/core` (and `@swc/types`) dependency scoped to builder.  
   - Create `createSwcParser` utility wrapping `parse` with TypeScript syntax + decorators disabled; ensure consistent options for `.ts/.tsx/.js/.jsx`.  
   - Define AST helper types for tracking export declarations, call expressions, member expressions, and literal arguments needed for `gql.*` detection.

2. **Stage B — Module Analysis & Canonical IDs**
   - Implement `analyzeModule(filePath, source)` returning: exported `gql` definitions, local symbol table, import/export metadata, and file-level hash.  
   - Enforce top-level-only invariant by filtering AST nodes accordingly; flag violations via structured builder errors.  
   - Produce canonical IDs `{absPath}::{exportName}` for direct exports and `{absPath}::{exportName}::{propertyName}` when definitions originate from object properties.  
   - Record AST spans required for later replacement (line/column) to enable thin plugin transforms.

3. **Stage C — Dependency Graph Resolution**
   - Build resolver that walks import graph using SWC data, resolves re-export chains, and maps references to canonical IDs.  
   - Integrate existing constraint: definitions uniquely identified by `{path}::{export}::{prop}`; maintain map for both exports and importers.  
   - Detect cycles using graph algorithms (Tarjan/Kosaraju) operating on canonical IDs; produce neverthrow errors preserving chain order.

4. **Stage D — Execution & Document Emission**
   - Introduce execution sandbox that `import()`s target modules via Bun after dependency resolution, injecting `@/graphql-system` runtime.  
   - Reuse `createDocumentRegistry` to register models/slices/operations; generate actual GraphQL documents via core document builders.  
   - Distinguish runtime vs zero-runtime modes: runtime mode writes evaluated JSON for tests; zero-runtime mode outputs manifest only.  
   - Embed metadata: dependency edges, transform selectors, hash of evaluated closure (via stable JSON serialisation of selection AST).

5. **Stage E — Caching & Incremental Runs**
   - Persist file-level cache to `.cache/soda-gql/builder` keyed by `{fileHash}.json`, containing AST summary + export metadata.  
   - Store evaluation cache keyed by canonical ID + dependency hashes to skip re-execution when inputs unchanged.  
   - Provide invalidation hooks for `--watch`: subscribe to `Bun.watch` on entry roots, recompute changed modules only, reuse cached registry state.

6. **Stage F — CLI Integration & Reporting**
   - Update CLI option parsing (with Zod) for precise error codes (`PARAM_REQUIRED`, `MODE_UNSUPPORTED`, etc.).  
   - Enhance `writeArtifact` to support `human` format (pretty diagnostics) alongside JSON.  
   - Produce final artifact structure matching `/specs/001-zero-runtime-gql-in-js/contracts/builder-pipeline.md`, including ref map + report metrics.  
   - Log cache hits/misses and duration metrics to aid plugin performance tuning.

## Testing & Quality Strategy
- Follow TDD (t_wada): write failing unit tests before implementation.  
- Unit tests: SWC analysis (`analyzeModule`), dependency resolver, caching layer, CLI parser.  
- Integration tests: end-to-end fixture executing builder in both runtime and zero-runtime modes, covering cycles, duplicate documents, object-property exports, and re-export scenarios.  
- Property-based tests (where practical) to ensure canonical ID stability across path formats (Windows vs POSIX).

## Open Questions / Research
- Optimal approach for evaluating user modules inside Bun while isolating side effects—may require `Bun.build` with virtual entry or dynamic import with controlled globals.  
- Strategy for resolving tsconfig path aliases within builder without invoking full TypeScript compiler (possible reuse of `@soda-gql/codegen` path resolver).  
- Whether AST summaries should include literal GraphQL strings to aid diff-friendly output or delegate entirely to registry output.

## Immediate Next Actions
1. Introduce SWC dependency and scaffold parser utility + analysis result types.  
2. Replace `discover.ts` RegExp logic with Stage B analyzer returning canonical IDs and export metadata.  
3. Design cache interfaces (in-memory map + filesystem persistence) informed by analyzer outputs.

---
*Plan captured for builder-centric rework; aligns future work with SWC-driven analysis, cacheable execution, and thin plugin integrations.*
