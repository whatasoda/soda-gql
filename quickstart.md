# Quickstart: Zero-runtime GraphQL Query Generation

This guide demonstrates the basic usage of the zero-runtime GraphQL generation system using the new type-driven architecture.

## Installation

```bash
# Install the core package and build plugin
bun add @soda-gql/core
bun add -D @soda-gql/plugin-babel  # Minimum requirement
bun add -D @soda-gql/cli           # For schema generation

# Install peer dependencies
bun add zod neverthrow
```

**Note**: This initial version supports queries and mutations only. Subscriptions, directives, and native GraphQL fragments are planned for future releases.

## Setup

### 1. Configure Your Schema

Place your GraphQL schema file:

```graphql
# schema.graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments(limit: Int, offset: Int): [Comment!]!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  createdAt: String!
  updatedAt: String!
}

type Query {
  user(id: ID!): User
  users: [User!]!
  post(id: ID!): Post
  posts(limit: Int, offset: Int): [Post!]!
}

type Mutation {
  createPost(title: String!, content: String!): Post!
  updatePost(id: ID!, title: String, content: String): Post
}
```

### 2. Prepare Inject File (Scalars and Adapter)

Code generation expects user-defined scalar definitions and an optional adapter. Scaffold a template and adjust it as needed for your environment:

```bash
# Create a starting point for scalar + adapter definitions
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

Edit `./src/graphql-system/default.inject.ts` to describe each custom scalar and optionally configure the adapter. The template uses `defineScalar()` and `defineAdapter()` helpers for type safety.

```ts
import { defineAdapter, defineScalar } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  // Add custom scalars
  ...defineScalar<"DateTime", string, Date>("DateTime"),
  ...defineScalar<"Money", number, number>("Money"),
} as const;

export const adapter = defineAdapter({
  helpers: {},
  metadata: {
    aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
  },
});
```

Replace or extend the examples to match the scalars in your schema.

### 3. Generate GraphQL System

```bash
# Generate the type-safe GraphQL system
bun run soda-gql codegen \
  --schema ./schema.graphql \
  --out ./src/graphql-system/index.ts \
  --inject-from ./src/graphql-system/inject.ts

# Produce builder artifacts during development
bun run soda-gql builder \
  --mode runtime \
  --entry ./src/pages/**/*.ts \
  --out ./.cache/soda-gql/runtime.json
```

`codegen` emits a complete runtime schema file that imports your scalar and adapter definitions. The `builder` command continues to generate runtime documents for development.

## Basic Usage

### Step 1: Define Fragments with `gql.default`

Fragments are declared with `fragment.<TypeName>(options, fieldsBuilder, normalize)` using the array-based API. The fields builder receives `f` for selections and `$` for fragment-scoped variables, and returns an array of field selections.

```typescript
// src/fragments/user.fragment.ts
import { gql } from "@/graphql-system";

// Basic user fragment with field selection
export const userBasic = gql.default(({ fragment }) =>
  fragment.User(
    {},
    ({ f }) => [
      //
      f.id(),
      f.name(),
    ],
    (selected) => ({
      id: selected.id,
      name: selected.name,
    }),
  ),
);

// User with nested posts selection
export const userWithPosts = gql.default(({ fragment }, { $var }) =>
  fragment.User(
    {
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.id(),
      f.name(),
      f.posts({ categoryId: $.categoryId })(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
    (selected) => ({
      id: selected.id,
      name: selected.name,
      posts: selected.posts.map((post) => ({
        id: post.id,
        title: post.title,
      })),
    }),
  ),
);

// Export inferred types
export type UserBasic = ReturnType<typeof userBasic["normalize"]>;
export type UserWithPosts = ReturnType<typeof userWithPosts["normalize"]>;
```

### Step 2: Build queries and mutations

`query.operation` / `mutation.operation` define complete GraphQL operations. The options object takes `name` and (optionally) `variables`.

```typescript
// src/operations/profile.query.ts
import { gql } from "@/graphql-system";
import { userWithPosts } from "../fragments/user.fragment";

export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({
        id: [$.userId],
        categoryId: $.categoryId,
      })(({ f }) => [userWithPosts.embed({ categoryId: $.categoryId })]),
    ],
  ),
);
```

```typescript
// src/operations/update-user.mutation.ts
import { gql } from "@/graphql-system";

export const updateUserMutation = gql.default(({ mutation }, { $var }) =>
  mutation.operation(
    {
      name: "UpdateUser",
      variables: [$var("id").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ f, $ }) => [
      f.updateUser({ id: $.id, name: $.name })(({ f }) => [f.id(), f.name()]),
    ],
  ),
);
```

### Step 3: Execute and parse responses

Use the generated document and parser to run operations. After the Babel transform runs, the runtime replaces this call with `gqlRuntime.getOperation(...)` while preserving metadata.

```typescript
import { profileQuery } from "@/queries/profile.query";
import { graphqlClient } from "./client";

const executionResult = await graphqlClient({
  document: profileQuery.document,
  variables: { userId: "42", categoryId: null },
});
```

## Testing Fragments

```typescript
// src/fragments/__tests__/user.fragment.test.ts
import { describe, expect, test } from "bun:test";
import { userBasic } from "../user.fragment";

describe("userBasic fragment", () => {
  test("normalizes data", () => {
    const normalized = userBasic.normalize({ id: "1", name: "Ada Lovelace" });
    expect(normalized).toEqual({ id: "1", name: "Ada Lovelace" });
  });

  test("builds fragments", () => {
    const fragment = userBasic.embed();
    expect(fragment.id).toBeDefined();
    expect(fragment.name).toBeDefined();
  });
});
```


## Build-time Optimization

**Before (development)**
```typescript
export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    { name: "ProfilePageQuery", variables: [$var("userId").scalar("ID:!")] },
    ({ f, $ }) => [
      f.users({ id: [$.userId] })(({ f }) => [f.id(), f.name()]),
    ],
  ),
);
```

**After (production build)**
```typescript
import { gqlRuntime } from "@soda-gql/runtime";

export const profileQuery = gqlRuntime.getOperation("ProfilePageQuery");
```

## Common Patterns

```
src/
├── entities/
│   └── user/
│       └── fragments/user.fragment.ts
├── features/
│   └── profile/
│       └── operations/
│           ├── profile.query.ts
│           └── update-user.mutation.ts
└── pages/
    └── profile/
        └── profile.page.ts
```

## Error Handling with neverthrow

```typescript
// src/operations/safe-user.query.ts
import { err, ok } from "neverthrow";
import { gql } from "@/graphql-system";
import { userBasic } from "@/fragments/user.fragment";

export const safeGetUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "SafeGetUser",
      variables: [$var("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.user({ id: $.id })(({ f }) => [userBasic.embed()]),
    ],
  ),
);

// Usage with neverthrow
async function getUser(id: string) {
  const result = await executeQuery(safeGetUserQuery, { id });
  if (result.isErr()) {
    return err(result.error);
  }
  const user = result.value.user;
  if (!user) {
    return err(new Error("User not found"));
  }
  return ok(userBasic.normalize(user));
}
```

## Troubleshooting

### Type Errors in Generated Code

1. Ensure schema is up to date: `bunx soda-gql generate`
2. Check that TypeScript includes `graphql-system` directory
3. Restart TypeScript service in your IDE

### Fragments Not Being Transformed

1. Verify Babel plugin is configured correctly
2. Check that files are being processed by Babel
3. Enable verbose logging in plugin configuration

### Performance Issues

1. Use field selection carefully - avoid selecting entire schema
2. Implement pagination for list fields
3. Use model composition to reuse selections

## Next Steps

- Explore the type system in `docs/type-system.md`.
- Review composition patterns in `docs/fragments.md`.
- Check the migration guide in `docs/migration.md`.
