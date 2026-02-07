# Affected Areas & Implementation

> Part of [Tagged Template API Unification](./index.md)

## Affected Areas

### Core package (`packages/core/`)

**Removals:**
- `src/composer/fields-builder.ts` (~187 lines) — callback-specific field factory
- `src/composer/var-builder.ts` (~280 lines) — variable builder DSL
- `src/types/element/fields-builder.ts` (~235 lines) — callback-specific types
- Inference utilities in `src/types/type-foundation/` — deferred-specifier, type-modifier complexity

**Modifications:**
- `src/composer/gql-composer.ts` — tagged template support in callback context
- `src/composer/fragment.ts`, `src/composer/operation.ts` — tagged template element creation
- `src/composer/compat.ts` — internal representation adapted: fieldsBuilder callback → GraphQL source string (`TemplateCompatSpec`)
- `src/composer/extend.ts` — accept `TemplateCompatSpec` (GraphQL string-based deferred spec) alongside existing `CompatSpec`
- `src/types/element/compat-spec.ts` — `CompatSpec` adapted to `TemplateCompatSpec`; stores `graphqlSource` instead of `fieldsBuilder`
- `src/types/fragment/field-selection.ts` — simplify, remove inference helpers

**New:**
- `src/graphql/` — shared GraphQL analysis utilities moved from codegen's graphql-compat (parser, transformer, fragment-args-preprocessor)

**Retained as-is:**
- `src/prebuilt/type-calculator.ts` — used by typegen
- `src/runtime/` — source-agnostic, no changes needed
- `src/types/element/gql-element.ts` — base element class
- `src/types/schema/` — schema type definitions

### Builder package (`packages/builder/`)

**Modifications:**
- `src/ast/adapters/typescript.ts` — detect `TaggedTemplateExpression` in callback bodies
- `src/ast/adapters/swc.ts` — same detection for SWC adapter
- `src/intermediate-module/codegen.ts` — tagged template callbacks generate intermediate modules that invoke tagged template functions
- `src/intermediate-module/evaluation.ts` — tagged template callbacks are evaluated in VM like callback builders; the tagged template function parses GraphQL within the VM context

**Key insight**: Tagged templates do **not** skip VM evaluation. The tagged template functions (`query\`...\``, `fragment\`...\``) are executed within the builder's VM context, where they parse GraphQL strings with `graphql-js` and produce Operation/Fragment elements. The architectural simplification comes from eliminating the callback builder DSL (field factories, variable builders), not from bypassing VM evaluation.

### Codegen package (`packages/codegen/`)

**Modifications:**
- `src/generator.ts` — remove `inputTypeMethods` generation; simplify codegen output

**Migration:**
- `src/graphql-compat/parser.ts`, `transformer.ts` — core analysis logic moves to `packages/core/src/graphql/` for sharing with typegen and tagged template functions. Codegen re-exports or imports from core.

### Typegen package (`packages/typegen/`)

**Modifications:**
- `src/runner.ts` — new pipeline: extract templates from source → parse GraphQL → calculate types
- `src/prebuilt-generator.ts` — simplify callback-builder resolution types

**New:**
- Template extraction (reuse LSP's `document-manager.ts` SWC-based pattern)
- GraphQL AST → field selection converter (reuse `graphql-compat` parser/transformer logic)

### Transformer packages (`packages/tsc/`, `packages/swc/`, `packages/babel/`)

**Modifications:**
- Add `TaggedTemplateExpression` detection alongside existing `CallExpression` handling
- Replacement logic is identical: `gql.default(...)` → `gqlRuntime.getOperation(canonicalId)`

### LSP package (`packages/lsp/`)

**Already supports tagged templates.** No breaking changes. May need updates if the tagged template API evolves (e.g., new context members).

### Tests and fixtures

**Full rewrite needed:**
- `packages/core/test/` — all tests use callback builder patterns
- `packages/core/src/**/*.test.ts` — unit tests for callback-specific code
- `packages/builder/test/` — builder fixtures use callback builders
- `fixture-catalog/` (~87 files) — all use callback builders

### Documentation

**Full update needed:**
- `README.md` — API examples
- `docs/guides/` — builder-flow, define-element, etc.
- `website/docs/` — getting-started, API reference, recipes

## Implementation Phases

### Phase 1: Builder + Transformer tagged template support

Establish the build pipeline for tagged templates. After this phase, tagged template operations build and run correctly alongside callback builders.

- Extend builder AST adapters to detect tagged templates in callback bodies
- Implement tagged template functions (`query\`...\``, `fragment\`...\``) that parse GraphQL within VM context
- Update transformers (tsc, swc, babel) to handle tagged template nodes
- Integration tests for tagged template build pipeline

### Phase 2: Typegen tagged template support

Enable type generation from tagged templates. After this phase, `typegen --watch` provides type feedback for tagged template operations.

- Implement template extraction from source files (reuse LSP document-manager pattern)
- Implement GraphQL AST → field selection conversion (reuse graphql-compat logic)
- Update typegen runner to support direct GraphQL string → type calculation
- Stabilize `typegen --watch` for reliable development feedback

### Phase 3: Callback builder API removal + type inference cleanup

Remove the callback builder API and associated type inference code. After this phase, the codebase is simplified.

- Remove fields-builder, var-builder composers
- Remove callback-specific type definitions and inference utilities
- Simplify codegen output (remove inputTypeMethods, field builder factories)
- Adapt compat composer to `TemplateCompatSpec` (GraphQL source string-based deferred spec)

### Phase 4: Tests, fixtures, and documentation update

Update all tests, fixtures, and documentation to reflect the tagged template-only API.

- Rewrite core tests and builder tests
- Rewrite fixture catalog
- Update README and all documentation guides
- Update website documentation

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| `typegen --watch` latency degrades DX | High | Profile and optimize. Incremental rebuilds (only re-process changed files). Leverage builder's fingerprint-based caching. |
| Tagged template build pipeline has subtle differences from callback builder | Medium | Extensive integration tests comparing artifacts from both pipelines before removing callback API. |
| Advanced features (attach, define, colocate) interaction with tagged templates | Low | These features operate at the element wrapper level, not the field selection level. API surface is unchanged. Verified in design section. |
| Test/fixture rewrite volume | Medium | AI-assisted bulk rewriting. Tagged template tests are simpler than callback builder tests. |
| SWC Rust transformer changes for tagged template support | Medium | SWC adapter already handles member expression patterns. Tagged template detection is a straightforward addition. |
