# LSP-Integrated Development Workflow

This guide explains how to use the soda-gql Language Server Protocol (LSP) integration to develop GraphQL queries with full IDE support, without requiring continuous typegen regeneration.

## Overview

The LSP-first workflow provides:
- **Real-time type information** via hover and inlay hints
- **Field completion** based on your GraphQL schema
- **Inline diagnostics** for invalid field selections and arguments
- **Fragment spread support** with interpolation expressions
- **Development without typegen** — run typegen only when you need compile-time type safety

## Workflow Steps

### 1. Define Your GraphQL Schema

Create a `schema.graphql` file in your project:

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts(categoryId: ID): [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
}

type Query {
  users(limit: Int): [User!]!
  user(id: ID!): User
}
```

### 2. Configure soda-gql

Create `soda-gql.config.ts`:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./src/graphql-system/default.inject.ts",
    },
  },
});
```

### 3. Generate GraphQL System

Run schema codegen to generate the base runtime:

```bash
# First-time setup: generate inject template
bun run soda-gql codegen schema --emit-inject-template ./src/graphql-system/default.inject.ts

# Generate GraphQL system from schema
bun run soda-gql codegen schema
```

This creates:
- `src/graphql-system/index.ts` — Generated schema types and composer
- `src/graphql-system/default.inject.ts` — Custom scalar definitions

### 4. Install VS Code Extension

Install the `@soda-gql/vscode-extension` from the `.vsix` file:

```bash
# Package the extension (if building from source)
cd packages/vscode-extension
bun run build
bun run package

# Install in VS Code
code --install-extension soda-gql-*.vsix
```

Or install from the VS Code marketplace (when published).

### 5. Write Tagged Templates with LSP Support

Create your fragments and operations using tagged template syntax:

```typescript
import { gql } from "@/graphql-system";

// Fragment with LSP completion and diagnostics
export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment on User {
    id
    name
    email
  }`(),
);
```

**LSP Features in Action:**

- **Hover**: Hover over `name` to see `String!` type information
- **Inlay Hints**: See `: String!` hints after each field
- **Completion**: Type inside the fragment to get field suggestions
- **Diagnostics**: Invalid fields are underlined with error messages

### 6. Use Fragment Interpolation

Reference fragments in other fragments using interpolation:

```typescript
import { gql } from "@/graphql-system";

const userBaseFragment = gql.default(({ fragment }) =>
  fragment`fragment UserBase on User {
    id
    name
  }`(),
);

// Spread fragment via interpolation
export const userWithEmailFragment = gql.default(({ fragment }) =>
  fragment`fragment UserWithEmail on User {
    ...${userBaseFragment}
    email
  }`(),
);
```

The LSP understands fragment spreads via `...${frag}` and provides:
- **No false diagnostics** on interpolation placeholders
- **Completion** for fields on the same parent type
- **Hover information** for the interpolated fragment

### 7. Build Operations (Callback Builder for Fragment Spreads in Operations)

For operations that use fragment spreads, use the callback builder syntax:

```typescript
import { gql } from "@/graphql-system";
import { userFragment } from "./fragments";

// Operations with fragment spreads require callback builder syntax
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...userFragment.spread(),
      })),
    }),
  }),
);
```

**Note**: Operations using fragment spreads cannot use tagged template syntax (interpolation in operations is not supported). Use callback builders for this pattern.

### 8. Optional: Run Typegen for Compile-Time Type Safety

When you're ready for production or need TypeScript type checking, run typegen:

```bash
bun run soda-gql typegen
```

This generates:
- Type definitions for `$infer` helpers
- Compile-time validation of field selections
- Full TypeScript autocomplete for result types

**Development vs. Production:**
| Phase | LSP | Typegen |
|-------|-----|---------|
| Development (writing queries) | ✅ Required | ❌ Optional |
| Production (build/deploy) | ❌ Not needed | ✅ Recommended |

## LSP vs. Typegen Comparison

| Feature | LSP | Typegen |
|---------|-----|---------|
| Field type information | ✅ Hover + inlay hints | ✅ TypeScript types |
| Field completion | ✅ Real-time | ✅ TypeScript autocomplete |
| Diagnostics | ✅ Inline errors | ✅ Compile-time errors |
| Fragment spread analysis | ✅ Cross-file | ✅ TypeScript inference |
| Runtime overhead | ❌ None | ❌ None (zero-runtime) |
| Requires regeneration | ❌ No | ✅ Yes (on schema changes) |
| Works without build step | ✅ Yes | ❌ No (needs codegen) |

## Tagged Template Syntax Support

The LSP fully supports tagged template syntax for fragments and simple operations:

### Fragments (Tagged Template)

```typescript
export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment on User {
    id
    name
  }`(),
);
```

### Operations (Tagged Template)

```typescript
export const listUsersQuery = gql.default(({ query }) =>
  query`query ListUsers {
    users {
      id
      name
    }
  }`(),
);
```

### Fragment Interpolation (Tagged Template)

```typescript
export const extendedFragment = gql.default(({ fragment }) =>
  fragment`fragment ExtendedUser on User {
    ...${userFragment}
    email
  }`(),
);
```

### Operations with Fragment Spreads (Callback Builder Only)

```typescript
// Must use callback builder for fragment spreads in operations
export const profileQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfileQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...userFragment.spread(),
      })),
    }),
  }),
);
```

## Troubleshooting

### LSP Not Providing Completion

1. Verify VS Code extension is installed: `Extensions > @soda-gql`
2. Check LSP server is running: `Output > soda-gql Language Server`
3. Ensure `codegen schema` has been run and output directory exists
4. Restart VS Code: `Developer: Reload Window`

### Interpolation Diagnostics Errors

If you see false errors on `...${frag}` patterns:
1. Ensure the fragment is imported correctly
2. Verify the fragment and parent context share the same parent type
3. Check the LSP server output for parsing errors

### Hover Not Showing Type Information

1. Verify your cursor is on a field name (not whitespace)
2. Check the schema is valid and loaded by the LSP
3. Ensure the field exists on the parent type in the schema

## Next Steps

- See [Tagged Template Guide](./tagged-template-guide.md) for syntax details
- See [Fragment Composition](./fragment-composition.md) for advanced patterns
- See [Main README](../../README.md) for full feature overview
