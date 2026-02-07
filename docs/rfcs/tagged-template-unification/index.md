# RFC: Tagged Template API Unification

## Status

**Accepted**

## Summary

This RFC defines the plan to unify soda-gql's API around tagged template literals as the primary method for defining GraphQL operations and fragments. The callback builder API will be restructured and retained alongside tagged templates, and type information will be generated via `typegen` rather than TypeScript-level inference.

The design commits to these key decisions:

1. **Tagged Template as the Primary API**: The tagged template syntax becomes the primary method for defining operations and fragments inside `gql.{schemaName}(callback)`. The callback builder API (`query.operation(...)`, `fragment.User(...)`, `$var(...)`) is restructured and retained, not removed.
2. **Type Generation over Type Inference**: Complex TypeScript type inference is replaced by `typegen` (watch mode). Build/runtime code is generated once via `codegen schema`; only type information is regenerated on change.
3. **Build Pipeline Independence**: Type generation does not trigger rebuilds in build tools that are not type-aware. Build tools (SWC, Babel, etc.) operate on the tagged template output without needing type information.

## Navigation

- [Design Decisions](./design-decisions.md)
- [Affected Areas & Implementation](./affected-areas.md)
- [Resolved Questions & References](./resolved-questions.md)

## Motivation

### AI-Driven development prioritizes readability

soda-gql assumes AI-driven implementation as the primary authoring model. When AI writes the code, human writability is secondary — **readability is the top priority**. Tagged template literals embed standard GraphQL syntax directly in TypeScript, making operations immediately readable by both humans and AI without learning a custom builder DSL.

```typescript
// Tagged template: standard GraphQL, immediately readable
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
`());

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

The codebase currently maintains two parallel API paths: the callback builder and the tagged template (introduced for LSP support). This dual structure increases maintenance burden and creates confusion about which API to use. Establishing tagged template as the primary API and restructuring the callback builder simplifies the codebase and the user-facing documentation.

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
`());
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
