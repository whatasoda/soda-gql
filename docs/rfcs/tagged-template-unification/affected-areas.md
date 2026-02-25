# Affected Areas & Implementation

> Part of [Tagged Template API Unification](./index.md)

## Affected Areas

### Core package (`packages/core/`)

**Restructured** (callback builder retained, scope TBD):
- `src/composer/fields-builder.ts` (~187 lines) — callback-specific field factory (restructured)
- `src/composer/var-builder.ts` (~280 lines) — variable builder DSL (retained)
- `src/types/element/fields-builder.ts` (~235 lines) — callback-specific types (restructured)
- Inference utilities in `src/types/type-foundation/` — deferred-specifier, type-modifier complexity (restructured)

**Modifications:**
- `src/composer/gql-composer.ts` — tagged template support in callback context
- `src/composer/fragment.ts` — **replaced**: callback builder fragment composers removed; `fragment` context member becomes a pure tagged template function (see [Fragment decision](../tagged-template-unification/resolved-questions.md#fragment-context-member--tagged-template-only-no-hybrid))
- `src/composer/operation.ts` — tagged template element creation
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

**No modifications needed.** The existing builder pipeline handles tagged templates without changes:

- `src/ast/adapters/typescript.ts` — **No changes**. The outer `gql.default(arrowFn)` pattern is unchanged; adapters detect `CallExpression` with `ArrowFunction` argument, which is preserved. The callback body (containing the tagged template) is captured as expression text — the adapters are expression-agnostic.
- `src/ast/adapters/swc.ts` — **No changes**. Same reasoning as TypeScript adapter.
- `src/intermediate-module/codegen.ts` — **No changes**. Expression text is rendered as-is in intermediate modules. Tagged template expressions in the callback body are valid JavaScript.
- `src/intermediate-module/evaluation.ts` — **No changes**. VM executes the callback, which internally calls tagged template functions. `graphql-js` is resolved transitively via `@soda-gql/core` through the sandbox `require()`.

**Key insight**: Tagged templates do **not** skip VM evaluation. The tagged template functions (`query\`...\`()`, `fragment\`...\`()`) are executed within the builder's VM context, where they parse GraphQL strings with `graphql-js` and produce Operation/Fragment elements. The builder pipeline is expression-agnostic — it captures, transpiles, and executes callback expressions regardless of whether they use callback builder DSL or tagged template syntax.

### Codegen package (`packages/codegen/`)

**Modifications:**
- `src/generator.ts` — remove `inputTypeMethods` generation; simplify codegen output

**Migration:**
- `src/graphql-compat/parser.ts`, `transformer.ts` — core analysis logic moves to `packages/core/src/graphql/` for sharing with typegen and tagged template functions. Codegen re-exports or imports from core.

### Typegen package (`packages/typegen/`)

**Modifications:**
- `src/runner.ts` — new pipeline: extract templates from source → parse GraphQL → calculate types
- Prebuilt type generation moved to codegen `generateIndexModule()`

**New:**
- Template extraction (reuse LSP's `document-manager.ts` SWC-based pattern)
- GraphQL AST → field selection converter (reuse `graphql-compat` parser/transformer logic)

### Transformer packages (`packages/tsc/`, `packages/swc/`, `packages/babel/`)

**No modifications needed.** Transformers detect and replace `gql.default(...)` `CallExpression` nodes — this outer pattern is unchanged regardless of whether the callback body uses tagged templates or callback builders. The replacement logic (`gql.default(...)` → `gqlRuntime.getOperation(canonicalId)`) operates on the outer call expression only.

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

### Phase 1: Core tagged template implementation

Establish the core tagged template infrastructure. After this phase, tagged template operations and fragments are fully functional in the composer layer.

- Implement hybrid context shape for `query`/`mutation`/`subscription` (`Object.assign` with tagged template + `.operation` + `.compat`)
- Implement `fragment` as pure tagged template function (no hybrid, no callback builder — [decision](../tagged-template-unification/resolved-questions.md#fragment-context-member--tagged-template-only-no-hybrid))
- Implement `TemplateResult` with optional options parameter, no `.resolve()` — [decision](../tagged-template-unification/resolved-questions.md#templateresult-call-signature--optional-options-parameter)
- Implement accurate `VarSpecifier` construction for fragment arguments (AST + schema resolution)
- Generate `documentSource`-compatible data from tagged template AST (compatibility bridge — [decision](../tagged-template-unification/resolved-questions.md#documentsource-handling--maintain-with-compatibility-bridge))
- Integration tests for tagged template build pipeline

Note: Builder AST adapters and transformers require no modifications — they are expression-agnostic and operate on the outer `gql.default(...)` call pattern only.

### Phase 2: Typegen tagged template support

Enable type generation from tagged templates. After this phase, `typegen --watch` provides type feedback for tagged template operations.

- Implement template extraction from source files (reuse LSP document-manager pattern)
- Implement GraphQL AST → field selection conversion (reuse graphql-compat logic)
- Update typegen runner to support direct GraphQL string → type calculation
- Stabilize `typegen --watch` for reliable development feedback

### Phase 3: Callback builder API restructuring + compat adaptation

Restructure the callback builder API and adapt compat for tagged templates. After this phase, both APIs coexist with tagged template as primary.

- Restructure fields-builder, var-builder composers (scope TBD)
- Simplify type inference where possible
- Adapt compat composer to `TemplateCompatSpec` (GraphQL source string-based deferred spec)
- Resolve deferred design decisions (`documentSource` handling, callback builder restructuring scope)

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
| Tagged template build pipeline has subtle differences from callback builder | Medium | Extensive integration tests comparing artifacts from both pipelines. Both paths coexist, enabling side-by-side validation. |
| Advanced features (attach, define, colocate) interaction with tagged templates | Low | These features operate at the element wrapper level, not the field selection level. API surface is unchanged. Verified in design section. |
| Test/fixture rewrite volume | Medium | AI-assisted bulk rewriting. Tagged template tests are simpler than callback builder tests. |
| Callback builder restructuring scope unclear | Medium | Scope is deferred as an open item. Phase 3 addresses this after tagged template pipeline is stable. |
