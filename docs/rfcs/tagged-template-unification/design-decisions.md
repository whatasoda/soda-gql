# Design Decisions

> Part of [Tagged Template API Unification](./index.md)

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

This is an important feature for attaching runtime metadata (HTTP headers, caching hints, etc.) to operations and fragments. The metadata chaining pattern is already specified in the [LSP RFC](../graphql-lsp-multi-schema.md) and supported by the LSP's template extraction.

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

This RFC preserves the Fragment Arguments syntax decision from the [LSP RFC](../graphql-lsp-multi-schema.md). Fragment variables use the [GraphQL Fragment Arguments proposal (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081):

```graphql
fragment UserProfile($showEmail: Boolean = false) on User {
  id
  name
  email @include(if: $showEmail)
}
```

The `graphql-js` parser does not support this syntax natively. Both the LSP and the builder preprocess fragment definitions by stripping argument declarations before parsing.
