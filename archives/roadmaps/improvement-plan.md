# soda-gql Improvement Plan (2025-09-29)

## Release Status
- Version: `0.1.0-pre`
- Contract: **Breaking changes allowed without restriction.**
- Compatibility Stance: We will redesign APIs, naming, packaging, and file layouts in pursuit of the ideal architecture. No migration guides or shims will be produced for legacy behavior.

## Executive Summary
- Treat the current codebase as a prototype. Preserve only concepts that demonstrably accelerate the new architecture.
- Collapse the split between SWC, TypeScript, and runtime layers into a single pipeline with explicit hand-offs and typed contracts.
- Rebuild developer tooling (CLI, builder, plugin) around incremental compilation, deterministic artifacts, and verifiable contracts instead of ad-hoc script collections.
- Elevate type rigor and Result-based error flows everywhere; delete convenience wrappers that hide failure modes.

## Priority Map
| Category | Priority | Bold Direction |
| --- | --- | --- |
| Architecture | P0 | Re-foundation of the builder+plugin contract with a shared intermediate representation (IR) package, dropping legacy interop signatures. |
| Error Handling | P0 | Replace all exception surfaces with `Result` pipelines and structured diagnostics, even if it breaks current CLI output. |
| Testing | P0 | Stand up multi-layer tests (unit, contract, integration) that assume the new IR; discard fixtures tied to the deprecated architecture. |
| Code Quality | P0 | Delete monolithic analyzers and rebuild them as composable modules; prefer rewrites over incremental patching. |
| Performance | P1 | Design for incremental rebuilds and cacheable outputs from day one; remove Bun-specific hacks as needed. |
| Dependencies | P1 | Promote shared utilities into dedicated packages (`@soda-gql/ir`, `@soda-gql/tooling-kit`), even if package names change. |
| Workflow | P1 | Standardise on a `just` + Bun dev loop with parallel builders; drop legacy scripts entirely. |
| Consistency | P2 | Re-establish naming conventions (modules, types, files) in one sweeping change. |
| Documentation | P2 | Rewrite contributor and user docs once the new architecture stabilises; no legacy sections. |

---

## 1. Architectural Reset (Priority: P0)

### Core Problems
- The current distinction between SWC and TypeScript analyzers duplicates business rules and obscures ownership boundaries.
- The Babel plugin reaches across package boundaries to consume builder internals via relative imports.
- Intermediate modules are ad-hoc `.ts` files, preventing deterministic runtime consumption.

### Bold Direction
- Introduce `@soda-gql/ir` (new package) exporting declarative IR schemas (Zod + TypeScript) that both the builder and the Babel plugin consume.
- Convert analyzers to emit IR events rather than materialising code directly. The IR becomes the sole contract between compile-time and runtime.
- Replace file-based intermediate modules with an artifact store (`packages/artifacts`) that snapshots IR + generated code in JSON/TS pairs with content-addressable keys.

### Execution Notes
1. Delete `packages/builder/src/ast/analyze-module.ts` and `analyze-module-swc.ts` in favour of smaller feature-specific analyzers housed under `packages/analyzer-swc/`.
2. Scaffold `packages/ir/` with:
   - `schema.ts` (Zod definitions for operations, fragments, runtime hints).
   - `manifest.ts` (package entry point returning a `Result<ArtifactManifest, SodaGqlError>`).
3. Rebuild the Babel plugin to depend exclusively on `@soda-gql/ir` for code generation, eliminating relative imports into builder internals.
4. Create `packages/artifact-store/` to manage artifact persistence (disk + in-memory cache) with content hashing.
5. Remove legacy CLI entry points that assume `.ts` intermediate files; rewrite `packages/cli` around the IR + artifact store design.

Compatibility: Not required. Replace consumers concurrently.

---

## 2. Error and Diagnostics Platform (Priority: P0)

### Core Problems
- Errors are thrown across layers, losing structured metadata and forcing ad-hoc string parsing.
- CLI output is inconsistent and not machine friendly.

### Bold Direction
- Centralise all diagnostic types in `@soda-gql/diagnostics` with JSON schemas for machine-readable output.
- Enforce `Result<T, Diagnostic>` return types across analyzers, artifact store, and CLI commands.
- Produce deterministic diagnostic files alongside artifacts to support editor integrations.

### Execution Notes
1. Create `packages/diagnostics/` with:
   - `codes.ts` enumerating all diagnostic codes.
   - `formatters/{cli, vscode}.ts` for rendering.
   - `adapters/{babel, builder}.ts` bridging existing layers.
2. Replace `throw` usage in all packages with `err()` returns. Delete helper utilities that unwrap results silently.
3. Update CLI commands to stream diagnostics to stdout as NDJSON, removing compatibility flags.
4. Standardise integration tests on snapshotting diagnostic payloads; regenerate fixtures where structure changes.

Compatibility: Existing CLI consumers must adapt; we will not provide fallbacks.

---

## 3. Testing and Verification (Priority: P0)

### Core Problems
- Current test suite couples to legacy artifacts and uses throw-based assertions.
- Coverage is incidental and not aligned with the new IR-driven architecture.

### Bold Direction
- Rebuild the test matrix around the new IR pipeline: analyzer unit tests, artifact contract snapshots, CLI end-to-end scenarios.
- Remove or rewrite any test that asserts on deprecated file formats or exception messages.

### Execution Notes
1. Stand up `tests/unit/ir/` verifying schema validators, plus `tests/contract/plugin-ir/` snapshotting generated runtime code.
2. Introduce custom Bun test matchers for `Result` handling (`expect(result).toBeOk()` / `toBeErrWithCode()`), replacing manual guards.
3. Add an integration harness under `tests/integration/pipeline/` that simulates the full `analyze → ir → artifact → runtime` flow.
4. Wire coverage gates (85% target) into `bun test --coverage`, accepting that baseline may drop temporarily while new tests are authored.

Compatibility: Remove all references to legacy fixtures; breaking changes expected.

---

## 4. Code Quality and Package Layout (Priority: P0)

### Core Problems
- Monolithic files (800+ lines) block comprehension and reuse.
- Package boundaries are porous, with shared utilities buried in unrelated modules.

### Bold Direction
- Decompose large files into purpose-built packages (`analyzer-swc`, `ir`, `artifact-store`, `diagnostics`, `cli`).
- Rename modules, types, and exports wholesale to match the new architecture; do not maintain alias layers.

### Execution Notes
1. Create per-feature directories with minimal public surface (`index.ts` exporting explicit factories or functions).
2. Apply a consistent naming scheme (`analyze*`, `emit*`, `resolve*`) across packages; update every import accordingly.
3. Remove redundant TypeScript analyzer if the SWC path can fully cover our use cases.
4. Document new conventions in `docs/guides/*` and enforce with lint rules or codemods.

Compatibility: Delete transitional code and type aliases once replacements land.

---

## 5. Developer Workflow (Priority: P1)

### Core Problems
- Build/dev scripts are ad-hoc (`bun write`, random watchers).
- No single entry point orchestrates analyzer, plugin, and runtime verification.

### Bold Direction
- Standardise on a `just` file orchestrating analyzer rebuilds, artifact generation, and integration smoke tests.
- Replace Bun-specific shortcuts with cross-platform Node APIs where needed for reliability.

### Execution Notes
1. Author `justfile` with tasks: `bootstrap` (install + codegen), `dev` (watch analyzer + artifact store), `verify` (tests + typecheck + lint), `pipeline` (one-off IR build).
2. Update `package.json` scripts to delegate to `just`, removing legacy scripts entirely.
3. Provide developer onboarding docs that assume the new workflow; delete outdated README sections.

Compatibility: Engineers must adopt the new commands; old scripts will be removed.

---

## 6. Naming and Patterns (Priority: P2)

### Bold Direction
- Conduct a single sweeping renaming pass (packages, exports, file names) once the new architecture is stable.
- Align on American English terminology across the monorepo (`analysis`, `synchronization`, `behavior`).

### Execution Notes
1. Draft a naming glossary in `docs/decisions/naming.md` before codifying changes.
2. Apply codemods to enforce the new naming rules.
3. Update ESLint/Biome configs to guard against legacy names.

Compatibility: Expect widespread breakage until downstream references are updated.

---

## Documentation Principles (Priority: P2)
- Rewrite all guides and READMEs only after the new architecture lands; delete legacy migration sections.
- Document forward-looking architecture diagrams rather than historical context.
- Provide newcomer guides that assume the IR + artifact store worldview from the outset.

