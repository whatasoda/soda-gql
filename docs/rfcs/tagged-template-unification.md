# RFC: Tagged Template API Unification

## Status

**Accepted**

## Summary

This RFC defines the plan to unify soda-gql's API around tagged template literals as the sole method for defining GraphQL operations and fragments. The callback builder API will be removed entirely, and type information will be generated via `typegen` rather than TypeScript-level inference.

The design commits to these key decisions:

1. **Tagged Template as the Only API**: The callback builder API (`query.operation(...)`, `fragment.User(...)`, `$var(...)`) is removed. All operations and fragments are defined using tagged template syntax inside `gql.{schemaName}(callback)`.
2. **Type Generation over Type Inference**: Complex TypeScript type inference is replaced by `typegen` (watch mode). Build/runtime code is generated once via `codegen schema`; only type information is regenerated on change.
3. **Build Pipeline Independence**: Type generation does not trigger rebuilds in build tools that are not type-aware. Build tools (SWC, Babel, etc.) operate on the tagged template output without needing type information.

## Motivation

### AI-Driven development prioritizes readability

soda-gql assumes AI-driven implementation as the primary authoring model. When AI writes the code, human writability is secondary — **readability is the top priority**. Tagged template literals embed standard GraphQL syntax directly in TypeScript, making operations immediately readable by both humans and AI without learning a custom builder DSL.

```typescript
// Tagged template: standard GraphQL, immediately readable
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
`);

// Callback builder: custom DSL, requires learning soda-gql's API
const GetUser = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
      })),
    }),
  })
);
```

### Dual API complexity

The codebase currently maintains two parallel API paths: the callback builder and the tagged template (introduced for LSP support). This dual structure increases maintenance burden and creates confusion about which API to use. Unifying to a single API simplifies the codebase and the user-facing documentation.

### Type inference complexity is not justified

The callback builder API's primary advantage is TypeScript-level type inference for field selections and variables. However, this comes at significant cost:

- **~30-50% of core package code** exists solely for type inference (fields-builder, var-builder, type-foundation utilities)
- **Complex generated types** in codegen output (`inputTypeMethods`, field builder factories)
- **Bundler compatibility issues** requiring a separate prebuilt types system
- **TypeScript 7 (tsgo/Corsa)** will drop Language Service Plugin support, making TS-level tooling unreliable long-term

With `typegen --watch` providing fast type feedback and LSP providing IDE features (autocomplete, diagnostics, hover), the callback builder's type inference no longer provides unique value.

### Codegen strategy shift

The original soda-gql concept was "no repeated code generation" — types were inferred at the TypeScript level, eliminating the codegen loop. This RFC partially reverses that decision:

- **Build/runtime code**: Generated once via `codegen schema` (unchanged)
- **Type information**: Generated on each change via `typegen` (new requirement)
- **Build tools**: Not affected by type generation (type-unaware tools like SWC/Babel do not re-build when types change)

This trade-off is acceptable because `typegen --watch` provides near-instant feedback, and the simplification of the codebase outweighs the cost of running a watch process.

## Background & Current State

### Current architecture

```
soda-gql.config.ts
  schemas: { default: {...}, admin: {...} }
      |
      +-> [Codegen] -> graphql-system/index.ts (typed composer + runtime)
      |                   exports: gql.default(), gql.admin()
      |                   includes: field builders, inputTypeMethods, type inference
      |
      +-> [Builder] -> Static analysis of gql.{schema}() calls
      |       |
      |       +-> [Intermediate Module] -> VM evaluation of callbacks
      |       |
      |       +-> [Artifact] -> Canonical ID -> prebuild data
      |
      +-> [Transformer] -> Replaces gql calls with runtime lookups
      |       (tsc / swc / babel plugins)
      |
      +-> [Typegen] -> Prebuilt types from evaluated builder artifacts
      |
      +-> [LSP] -> IDE features for tagged templates (completion, diagnostics, hover)
```

### Two API styles currently coexist

**Callback builder** (primary, fully supported in builder/transformer/runtime):
```typescript
const GetUser = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  })
);
```

**Tagged template** (LSP-only, not supported in builder/transformer):
```typescript
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name }
  }
`);
```

### Tagged template: current support matrix

| Layer | Callback Builder | Tagged Template |
|-------|-----------------|-----------------|
| Core (runtime types) | Supported | Partial (types exist but not wired) |
| Builder (static analysis) | Supported | **Not supported** |
| Transformer (tsc/swc/babel) | Supported | **Not supported** |
| Runtime | Supported | Supported (same prebuild data) |
| LSP | Not applicable | Supported |
| Typegen | Supported (via builder artifacts) | **Not supported** |

### Key insight: artifact and runtime are source-agnostic

The `BuilderArtifact` and runtime (`createRuntimeOperation`, `createRuntimeFragment`) accept prebuild data that is independent of how the operation was authored. Both callback builders and tagged templates can produce identical prebuild data. This means the transformer and runtime require minimal changes — the primary work is in the builder and typegen layers.

## Design Decisions

### 5.1 Tagged template as the only API

The tagged template API becomes the sole method for defining operations and fragments. The `gql.{schemaName}(callback)` pattern is preserved — only the callback body changes.

#### API design

```typescript
import { gql } from "@/graphql-system";

// --- Operations ---

const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
`);

const UpdateUser = gql.default(({ mutation }) => mutation`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) { id name }
  }
`);

const OnMessage = gql.default(({ subscription }) => subscription`
  subscription OnMessage($roomId: ID!) {
    messageAdded(roomId: $roomId) { id text sender }
  }
`);

// --- Fragments ---

const UserFields = gql.default(({ fragment }) => fragment`
  fragment UserFields on User {
    id
    name
    email
  }
`);

// Fragment with variables (Fragment Arguments RFC syntax)
const UserProfile = gql.default(({ fragment }) => fragment`
  fragment UserProfile($showEmail: Boolean = false) on User {
    id
    name
    email @include(if: $showEmail)
  }
`);
```

#### Metadata chaining

The tagged template result is callable for metadata attachment:

```typescript
const PostList = gql.default(({ fragment }) => fragment`
  fragment PostList($first: Int!) on Query {
    posts(first: $first) { id title }
  }
`({
  metadata: { pagination: true },
}));
```

This is an important feature for attaching runtime metadata (HTTP headers, caching hints, etc.) to operations and fragments. The metadata chaining pattern is already specified in the [LSP RFC](./graphql-lsp-multi-schema.md) and supported by the LSP's template extraction.

#### attach, define, and colocate

These advanced features operate at the `gql.default(...)` return level, not inside the tagged template. They remain unchanged:

```typescript
// attach: extend elements with custom properties
const userFragment = gql.default(({ fragment }) => fragment`
  fragment UserFields on User { id name email }
`).attach({
  name: "form",
  createValue: (element) => ({ validate: () => true }),
});

userFragment.form.validate(); // works as before

// define: share values across gql definitions
const ApiConfig = gql.default(({ define }) =>
  define(() => ({
    defaultTimeout: 5000,
    retryCount: 3,
  }))
);

// colocate: fragment colocation
const UserCard = gql.default(({ fragment, $colocate }) => {
  $colocate(UserAvatar);
  return fragment`
    fragment UserCard on User {
      id
      name
      ...UserAvatar
    }
  `;
});
```

**Why this works**: The tagged template only replaces the `variables` and `fields` portion of the old API. The `gql.default(callback)` wrapper, `attach()`, `define()`, and `$colocate()` are orthogonal features that operate on the element returned from the callback, not on the field selection mechanism.

### 5.2 Type generation strategy

#### Build/runtime code: one-time generation

`codegen schema` generates the graphql-system module once. The output is simplified compared to the current version:

**Removed** (callback-builder specific):
- `inputTypeMethods` (the `$var("id").ID("!")` factory methods)
- Field builder factories (`f.user()`, `f.id()`, etc.)
- Complex type inference utilities

**Retained**:
- Schema type definitions (`_defs/objects.ts`, `_defs/inputs.ts`, `_defs/enums.ts`, `_defs/unions.ts`)
- Schema assembly (`__schema_default`, `__inputTypeMethods_default`, etc.)
- `gql` composer creation (`createGqlElementComposer`)
- Scalar definitions and adapter support

The codegen output becomes simpler because tagged templates do not require TypeScript-level field builders.

#### Type information: generated on change via typegen

`typegen --watch` monitors source files and generates type definitions:

```
Source files (*.ts, *.tsx)
    |
    v
[Template Extraction] -- Extract tagged templates via SWC AST
    |
    v
[GraphQL Parsing] -- Parse GraphQL strings with graphql-js
    |
    v
[Type Calculation] -- Resolve types against schema
    |
    v
types.prebuilt.ts (PrebuiltTypes registry)
```

The typegen pipeline is simplified because it reads GraphQL strings directly from source files, bypassing the builder's VM evaluation step.

#### Build tool independence

Type generation produces `.ts` type declaration files that are consumed by the TypeScript language server but not by build tools:

- **SWC/Babel/esbuild**: Transform `gql.default(...)` calls to runtime lookups. They parse the tagged template string but do not need type information.
- **TypeScript (tsc)**: Consumes `types.prebuilt.ts` for type checking. The transformer plugin also handles build-time replacement.
- **Vite/Webpack/Metro**: Delegate to their respective transformer plugins. Type files are not part of the dependency graph.

When `typegen --watch` regenerates `types.prebuilt.ts`, only TypeScript's type checker refreshes. Build tools do not re-trigger because the runtime code is unchanged.

### 5.3 Callback builder API removal

The following components are removed:

| Component | Location | Reason |
|-----------|----------|--------|
| `fields-builder.ts` (composer) | `packages/core/src/composer/` | Callback-specific field factory creation |
| `var-builder.ts` (composer) | `packages/core/src/composer/` | `$var("id").ID("!")` syntax |
| `fields-builder.ts` (types) | `packages/core/src/types/element/` | Callback-specific type definitions |
| Type inference utilities | `packages/core/src/types/type-foundation/` | Complex inference for callback patterns |
| `inputTypeMethods` generation | `packages/codegen/src/generator.ts` | Field builder factory code generation |
| Callback-specific tests | `packages/core/test/`, `packages/core/src/**/*.test.ts` | Test callback-specific behavior |

**Estimated reduction**: ~1,800-2,200 lines of implementation code, plus 60-80% reduction in type inference code. Note: compat and extend are retained (adapted, not removed), so the reduction is smaller than a full callback builder removal.

### 5.4 Fragment Arguments syntax

This RFC preserves the Fragment Arguments syntax decision from the [LSP RFC](./graphql-lsp-multi-schema.md). Fragment variables use the [GraphQL Fragment Arguments proposal (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081):

```graphql
fragment UserProfile($showEmail: Boolean = false) on User {
  id
  name
  email @include(if: $showEmail)
}
```

The `graphql-js` parser does not support this syntax natively. Both the LSP and the builder preprocess fragment definitions by stripping argument declarations before parsing.

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

## Open Questions (Resolved)

### Tagged template runtime execution → Build-time replacement

How do the `query`/`mutation`/`subscription`/`fragment` tagged template functions execute?

**Decision**: Tagged templates are **fully replaced at build time**. No GraphQL string parsing happens at runtime.

The execution model has two modes:

**Build mode** (production path):
1. Builder evaluates the callback in its VM context. The tagged template function (`query\`...\``) receives the GraphQL string, parses it with `graphql-js`, and produces an Operation/Fragment element
2. Builder collects the resulting element and generates prebuild data
3. Transformer replaces the entire `gql.default(({ query }) => query`...`)` call with `gqlRuntime.getOperation(canonicalId)`
4. Runtime receives pre-computed prebuild data — no parsing, no evaluation

**Development mode** (without build tool):
The same tagged template functions execute at import time:
1. Receives the `TemplateStringsArray` from the tagged template
2. Parses the GraphQL string with `graphql-js`
3. Extracts operation/fragment metadata (name, type, variables) from the AST
4. Creates `Operation` or `Fragment` elements with the parsed data

In both modes, the tagged template function parses GraphQL within its execution context. The difference is only in what happens **after**: build mode replaces the call site with a prebuild lookup, while development mode keeps the parsed result directly.

**Key difference from callback builder**: The callback builder's `documentSource()` and `spread()` functions are not needed. These existed to lazily evaluate field selections from TypeScript code. Tagged templates provide the complete GraphQL document as a string — field selections are extracted by parsing the GraphQL AST directly, either by the builder (build time) or by typegen (type generation time).

### Fragment dependency resolution → GraphQL AST analysis

How does the builder resolve fragment dependencies (e.g., `...UserFields` inside a query) in the tagged template model?

**Decision**: Parse GraphQL AST and collect `FragmentSpread` nodes.

The builder:
1. Extracts all tagged templates from source files across the project
2. Parses each GraphQL string with `graphql-js`
3. Uses `visit()` to find all `FragmentSpread` nodes (`...FragmentName`)
4. Builds a global fragment index keyed by `(fragmentName, schemaLabel)` — reusing the same pattern as the LSP's `indexFragments()` in `packages/lsp/src/document-manager.ts`
5. Resolves spreads by looking up the fragment index

**Collision handling**:
- Fragments are scoped by `schemaLabel`. A fragment named `UserFields` in schema `default` and another in schema `admin` are distinct entries.
- Same-name fragments within the same schema produce a builder warning. The first definition wins (consistent with GraphQL spec behavior).

**Cross-file resolution**:
The builder already scans all files matching `include` patterns. Fragment definitions are indexed during the discovery pass, before dependency resolution. No import tracking is needed at the builder level — the builder has global visibility of all definitions.

### Prebuilt type registry keys → GraphQL definition names

How does the prebuilt type registry (`PrebuiltTypeRegistry`) key work with tagged templates, where names come from GraphQL strings rather than explicit TypeScript parameters?

**Decision**: Use the GraphQL definition name directly as the registry key.

- **Operations**: `query GetUser { ... }` → registry key `"GetUser"`
- **Fragments**: `fragment UserFields on User { ... }` → registry key `"UserFields"`

This replaces the current system where:
- Operations use the `name` parameter from `query.operation({ name: "GetUser" })`
- Fragments use the optional `key` parameter from `fragment.User({ key: "UserFields" })`

**Changes**:
- The fragment `key` parameter is removed (no longer needed — the GraphQL fragment name is the identifier)
- Anonymous operations (no name) are not included in prebuilt types and produce a warning
- The `PrebuiltTypeRegistry` structure itself is unchanged — only the source of keys changes

**Collision handling**: Same as fragment dependency resolution — scoped by schema, warning on same-name collisions within a schema.

### graphql-compat future → Simplified tagged template emitter

What happens to the graphql-compat system (`codegen graphql`) that generates TypeScript from `.graphql` files?

**Decision**: The emitter is rewritten to output tagged template syntax instead of callback builder code.

**Current output** (617 lines of emitter code):
```typescript
export const GetUserCompat = gql.mySchema(({ query, $var }) =>
  query.compat({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

**New output** (~100-150 lines of emitter code):
```typescript
export const GetUser = gql.mySchema(({ query }) => query`
  query GetUser($userId: ID!) {
    user(id: $userId) {
      id
      name
    }
  }
`);
```

The new emitter is dramatically simpler because it only needs to:
1. Read the `.graphql` file content
2. Wrap each operation/fragment in the tagged template syntax
3. Generate import statements and export bindings

The parser (`parser.ts`) and transformer (`transformer.ts`) logic from graphql-compat — which handles schema type resolution, variable inference, and field type lookup — moves to `packages/core/src/graphql/`. This placement allows both codegen (emitter) and typegen to import shared analysis logic from core. The codegen package re-exports or imports from core.

### extend() feature → Compat preserved with adapted representation

What happens to the `extend()` composer and compat pattern with tagged templates?

**Decision**: `extend()` is kept. **Compat is preserved** with an adapted internal representation — `TemplateCompatSpec` stores a GraphQL source string instead of a `fieldsBuilder` callback.

**Why compat cannot be removed**: `extend()` requires **deferred execution**. It must build the operation with metadata and `transformDocument` at extend-time, not at definition-time. Tagged templates that produce `Operation` directly have already been built — there is no deferred specification to compose with. The compat pattern provides this deferred specification by storing the GraphQL source string without building the operation.

**Why extend() is still needed**: Cross-file operation composition. When File A defines an operation and File B needs to add metadata or `transformDocument`, File B must wrap its logic in its own `gql.default(callback)` call (required by the intermediate module system). Metadata chaining (`query\`...\`({ metadata })`) only works within a single `gql.default()` call, so it cannot compose across files.

**API: explicit two modes**

Direct mode — tagged template produces `Operation` immediately:
```typescript
const GetUser = gql.default(({ query }) => query`
  query GetUser($userId: ID!) {
    user(id: $userId) { id name }
  }
`);
```

Compat mode — tagged template produces deferred `GqlDefine<TemplateCompatSpec>` for extend:
```typescript
// File A — compat tagged template (deferred, stores GraphQL source string)
const GetUserCompat = gql.default(({ query }) => query.compat`
  query GetUser($userId: ID!) {
    user(id: $userId) { id name }
  }
`);

// File B — extends with metadata
const GetUser = gql.default(({ extend }) =>
  extend(GetUserCompat, {
    metadata: { headers: { "X-Auth": "token" } },
    transformDocument: (doc) => addDirectives(doc),
  })
);
```

**What changes**:
- Internal representation: `CompatSpec` (fieldsBuilder callback) → `TemplateCompatSpec` (GraphQL source string + schema + operationType)
- `extend.ts` adds a `TemplateCompatSpec` handling path: parses `graphqlSource`, extracts document/variables/fragment spreads, creates var refs, calls metadata builder, applies transforms
- `compat.ts` adapted to create `TemplateCompatSpec` from tagged template input
- The callback builder's `query.compat({ name, variables, fields })` API is removed (replaced by `query.compat\`...\``)

**What stays the same**:
- Purpose: cross-file composition of operations/fragments with metadata and transforms
- Position in the callback context: `({ extend }) => extend(importedElement, options)`
- Output: an `Operation` or `Fragment` with merged metadata/transforms
- The two-mode pattern: direct use vs compat for extend

### Adapter system → Unchanged

How do adapters (custom helpers, metadata aggregation, document transforms) interact with tagged templates?

**Decision**: The adapter system is unaffected. It operates at the `gql.default(callback)` context level, which is preserved.

Adapters provide:
- **Custom helpers** spread into the callback context — still available alongside `query`, `fragment`, etc.
- **Metadata aggregation** — works with metadata chaining on tagged template results
- **Document transforms** — applied to the final `TypedDocumentNode`, regardless of how it was produced

No changes to `packages/core/src/types/metadata/adapter.ts` or its integration in `gql-composer.ts`.

## Rejected Alternatives

### Approach A: Gradual migration (Dual API)

Maintain both callback builder and tagged template APIs indefinitely, making tagged template the recommended but not sole approach.

**Rejected**: Contradicts the "simplify" goal. Maintaining two API paths means two code paths in the builder, transformer, typegen, documentation, and tests. The codebase complexity that motivated this RFC would persist.

### Approach C: Hybrid simplification (compatibility layer)

Make tagged template the primary API but re-implement the callback builder as a thin compatibility layer that internally converts to tagged template representation.

**Rejected**: The compatibility layer would need to faithfully reproduce all callback builder features (field builders, variable builders, field selection types). The implementation and testing effort of the compatibility layer approaches that of maintaining the original API, without achieving meaningful simplification.

## Relationship to Existing RFCs

### GraphQL LSP RFC (graphql-lsp-multi-schema.md)

The LSP RFC introduced tagged templates as a complementary API alongside callback builders. This RFC **supersedes** the "both styles coexist" position (Section "Backward Compatibility" of the LSP RFC). Going forward, only tagged template syntax is supported.

The LSP RFC's technical decisions remain valid:
- Callback + tagged template structure (`gql.{schemaName}(callback)` with tagged template inside)
- Fragment Arguments RFC syntax
- Hybrid LSP architecture
- Schema association mechanism

### Field Selection Shorthand RFC (field-selection-shorthand.md)

The shorthand syntax RFC (`fields: ({ f }) => ({ id: true, name: true })`) was designed for the callback builder API. With callback builder removal, this RFC becomes **obsolete** — tagged templates use standard GraphQL field selection syntax natively.

## References

### soda-gql internals
- LSP document manager (tagged template extraction): `packages/lsp/src/document-manager.ts`
- GraphQL compat parser/transformer: `packages/codegen/src/graphql-compat/`
- Type calculator: `packages/core/src/prebuilt/type-calculator.ts`
- Typegen emitter: `packages/typegen/src/emitter.ts`
- Builder AST adapters: `packages/builder/src/ast/adapters/`
- Transformer (tsc): `packages/tsc/src/transformer.ts`
- Transformer (swc): `packages/swc/src/transform/`
- Runtime: `packages/core/src/runtime/`

### Related RFCs
- [GraphQL LSP with Multi-Schema Support](./graphql-lsp-multi-schema.md)
- [Field Selection Shorthand](./field-selection-shorthand.md) (obsoleted by this RFC)

### External references
- [Fragment Arguments proposal (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081)
- [TypeScript 7 / tsgo](https://github.com/microsoft/typescript-go)
