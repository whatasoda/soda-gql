# Design Decisions

> Part of [Tagged Template API Unification](./index.md)

### 5.1 Tagged template as the primary API

The tagged template API becomes the primary method for defining operations and fragments. The `gql.{schemaName}(callback)` pattern is preserved — only the callback body changes. The callback builder API is restructured and retained alongside tagged templates.

#### API design

```typescript
import { gql } from "@/graphql-system";

// --- Operations ---

const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
`());

const UpdateUser = gql.default(({ mutation }) => mutation`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) { id name }
  }
`());

const OnMessage = gql.default(({ subscription }) => subscription`
  subscription OnMessage($roomId: ID!) {
    messageAdded(roomId: $roomId) { id text sender }
  }
`());

// --- Fragments ---

const UserFields = gql.default(({ fragment }) => fragment`
  fragment UserFields on User {
    id
    name
    email
  }
`());

// Fragment with variables (Fragment Arguments RFC syntax)
const UserProfile = gql.default(({ fragment }) => fragment`
  fragment UserProfile($showEmail: Boolean = false) on User {
    id
    name
    email @include(if: $showEmail)
  }
`());
```

#### Context shape: hybrid tagged template functions

The callback context provides `query`, `mutation`, and `subscription` as **hybrid objects** — each is a tagged template function that also exposes properties. `fragment` is a **pure tagged template function** (not hybrid — see [Fragment context member decision](./resolved-questions.md#fragment-context-member--tagged-template-only-no-hybrid)).

**Operations (hybrid):**

```typescript
// query is callable as a tagged template:
gql.default(({ query }) => query`...`());

// query also has .compat for deferred mode:
gql.default(({ query }) => query.compat`...`);

// query also retains .operation() for callback builder (restructured):
gql.default(({ query, $var }) => query.operation({ ... }));
```

Implementation uses `Object.assign` to create the hybrid:

```typescript
const queryTaggedTemplate = createOperationTaggedTemplate(schema, "query");
const query = Object.assign(queryTaggedTemplate, {
  compat: createCompatTaggedTemplate(schema, "query"),
  operation: createOperationComposer("query"),  // callback builder (restructured)
});
```

This preserves backwards compatibility with the callback builder while making tagged templates the primary API.

**Fragment (pure tagged template — not hybrid):**

```typescript
// fragment is a pure tagged template function:
gql.default(({ fragment }) => fragment`
  fragment UserFields on User { id name }
`());

// fragment does NOT have type-keyed builders (fragment.User is NOT available):
// gql.default(({ fragment }) => fragment.User({ ... }));  // ← REMOVED
```

The `fragment` context member is `createFragmentTaggedTemplate(schema)` — a single tagged template function. The `on User` type condition is part of the GraphQL syntax, making type-keyed builders (`fragment.User`, `fragment.Post`) unnecessary.

#### Metadata chaining and always-call pattern

Tagged template functions return a `TemplateResult` — an internal intermediate type that is callable for metadata attachment. **The call is always required**, even without metadata:

```typescript
// Without metadata — empty call ()
const UserFields = gql.default(({ fragment }) => fragment`
  fragment UserFields on User { id name email }
`());

// With metadata — call with options
const PostList = gql.default(({ fragment }) => fragment`
  fragment PostList($first: Int!) on Query {
    posts(first: $first) { id title }
  }
`({
  metadata: { pagination: true },
}));
```

This is an important feature for attaching runtime metadata (HTTP headers, caching hints, etc.) to operations and fragments. The metadata chaining pattern is already specified in the [LSP RFC](../graphql-lsp-multi-schema.md) and supported by the LSP's template extraction.

#### TemplateResult: internal intermediate type

The `TemplateResult` type is the return value of tagged template functions (`query\`...\``, `fragment\`...\``). It is callable with an **optional** options parameter (`TemplateResultMetadataOptions?`):

- `()` — resolves to `Operation`/`Fragment` without metadata
- `({ metadata: { ... } })` — resolves to `Operation`/`Fragment` with metadata

There is no `.resolve()` method — the `()` call serves the same purpose. This avoids API redundancy and keeps the always-call pattern consistent.

**`TemplateResult` never escapes the callback.** The callback always returns a fully resolved `Operation`, `Fragment`, or `GqlDefine`. The `GqlElementComposer` type does not need to accept `TemplateResult` — the always-call pattern ensures resolution happens within the callback body.

#### attach, define, and colocate

These advanced features operate at the `gql.default(...)` return level, not inside the tagged template. They remain unchanged:

```typescript
// attach: extend elements with custom properties
const userFragment = gql.default(({ fragment }) => fragment`
  fragment UserFields on User { id name email }
`()).attach({
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
  `();
});
```

**Why this works**: The tagged template only replaces the `variables` and `fields` portion of the old API. The `gql.default(callback)` wrapper, `attach()`, `define()`, and `$colocate()` are orthogonal features that operate on the element returned from the callback, not on the field selection mechanism.

### 5.2 Type generation strategy

#### Build/runtime code: one-time generation

`codegen schema` generates the graphql-system module once. The output is simplified compared to the current version:

**Restructured or simplified** (callback-builder specific):
- `inputTypeMethods` (the `$var("id").ID("!")` factory methods) — scope of restructuring TBD
- Field builder factories (`f.user()`, `f.id()`, etc.) — scope of restructuring TBD
- Complex type inference utilities — scope of restructuring TBD

> **Open item**: The exact scope of callback builder restructuring (including `documentSource` handling) is deferred to a separate design discussion.

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

### 5.3 Callback builder API restructuring

The callback builder API for operations is restructured and retained. Fragment callback builders (`fragment.User(...)`) are removed — fragments use tagged template syntax exclusively (see [Fragment decision](./resolved-questions.md#fragment-context-member--tagged-template-only-no-hybrid)). The following table summarizes the planned changes for operation-related components:

| Component | Location | Status |
|-----------|----------|--------|
| `fields-builder.ts` (composer) | `packages/core/src/composer/` | **Restructured** — scope TBD |
| `var-builder.ts` (composer) | `packages/core/src/composer/` | **Retained** — `$var("id").ID("!")` syntax still used by callback builder |
| `fields-builder.ts` (types) | `packages/core/src/types/element/` | **Restructured** — scope TBD |
| Type inference utilities | `packages/core/src/types/type-foundation/` | **Restructured** — scope TBD |
| `inputTypeMethods` generation | `packages/codegen/src/generator.ts` | **Retained** — needed for callback builder |
| Callback-specific tests | `packages/core/test/`, `packages/core/src/**/*.test.ts` | **Updated** — expanded for tagged template coverage |

> **Open item**: The full scope of callback builder restructuring is deferred. The primary focus of this RFC is establishing tagged template as the primary API and ensuring both paths coexist through the hybrid context shape.

### 5.4 Fragment Arguments syntax

This RFC preserves the Fragment Arguments syntax decision from the [LSP RFC](../graphql-lsp-multi-schema.md). Fragment variables use the [GraphQL Fragment Arguments proposal (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081):

```graphql
fragment UserProfile($showEmail: Boolean = false) on User {
  id
  name
  email @include(if: $showEmail)
}
```

The `graphql-js` parser does not support this syntax natively. Both the LSP and the builder preprocess fragment definitions by stripping argument declarations before parsing.

### 5.5 Fragment variable definitions construction

Tagged template fragments construct accurate `VarSpecifier` objects from the GraphQL AST and schema reference at creation time. No placeholder strategy is used.

#### Construction flow

1. Parse the GraphQL string with `graphql-js` (after fragment arguments preprocessing)
2. Extract `VariableDefinitionNode` entries from the original source (before preprocessing stripped the argument syntax)
3. For each variable definition:
   - **`name`**: Extracted from `VariableDefinitionNode.type` (the GraphQL type name, e.g., `"Boolean"`, `"ID"`, `"UserInput"`)
   - **`modifier`**: Derived from the `TypeNode` structure (e.g., `"!"`, `"?"`, `"![]!"`)
   - **`defaultValue`**: Extracted from `VariableDefinitionNode.defaultValue` if present
   - **`kind`**: Resolved by looking up the type name in the schema — `"scalar"` for scalar types, `"enum"` for enums, `"input"` for input object types
   - **`directives`**: Extracted from `VariableDefinitionNode.directives`

#### Schema access

The `createFragmentTaggedTemplate(schema)` function already receives the schema as a parameter, providing access to schema type definitions for `kind` resolution:

```typescript
const resolveInputTypeKind = (schema: AnyGraphqlSchema, typeName: string): CreatableInputTypeKind => {
  if (typeName in schema.scalar) return "scalar";
  if (typeName in schema.enum) return "enum";
  if (typeName in schema.input) return "input";
  throw new Error(`Unknown input type: ${typeName}`);
};
```

This ensures that fragment variable definitions are type-accurate at creation time, enabling correct type generation by typegen without any deferred resolution.
