# Resolved Questions & References

> Part of [Tagged Template API Unification](./index.md)

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
- [GraphQL LSP with Multi-Schema Support](../graphql-lsp-multi-schema.md)
- [Field Selection Shorthand](../field-selection-shorthand.md) (obsoleted by this RFC)

### External references
- [Fragment Arguments proposal (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081)
- [TypeScript 7 / tsgo](https://github.com/microsoft/typescript-go)
