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

### 2. Prepare Scalars and Adapter

Code generation now expects user-defined scalar implementations and a runtime adapter. Scaffold a template and adjust it as needed for your environment:

```bash
# Create a starting point for scalar + adapter definitions
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/inject.ts
```

Edit `./src/graphql-system/inject.ts` to describe each custom scalar and to implement the `GraphqlRuntimeAdapter`. The template uses the new `defineScalar()` helper so each scalar stays strongly typed.

```ts
import { defineScalar } from "@soda-gql/core";
import { createRuntimeAdapter } from "@soda-gql/runtime";

export const scalar = {
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),
    output: type<Date>(),
    directives: {},
  })),
  ...defineScalar("Money", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
} as const;

export const adapter = createRuntimeAdapter(({ type }) => ({
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
}));
```

Replace or extend the examples to match the scalars and runtime behaviour in your own schema.

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

### Step 1: Define Models with `gql.default`

Models are declared with `model.<TypeName>(options, fieldsBuilder, normalize)` using the array-based API. The fields builder receives `f` for selections and `$` for model-scoped variables, and returns an array of field selections.

```typescript
// src/models/user.model.ts
import { gql } from "@/graphql-system";

// Basic user model with field selection
export const userBasic = gql.default(({ model }) =>
  model.User(
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
export const userWithPosts = gql.default(({ model }, { $ }) =>
  model.User(
    {
      variables: [$("categoryId").scalar("ID:?")],
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

### Step 2: Compose slices with projections

`slice.query`/`slice.mutation` wrap reusable field selections using array-based builders. Provide variable definitions as arrays, build fields returning arrays, and map execution results through `select`.

```typescript
// src/slices/user.slice.ts
import { gql } from "@/graphql-system";
import { userWithPosts } from "../models/user.model";

export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!"), $("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.users({
        id: [$.id],
        categoryId: $.categoryId,
      })(() => [
        //
        userWithPosts.fragment({ categoryId: $.categoryId }),
      ]),
    ],
    ({ select }) =>
      select(["$.users"], (result) =>
        result.safeUnwrap(([users]) => users.map((user) => userWithPosts.normalize(user))),
      ),
  ),
);

export const updateUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [$("id").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ f, $ }) => [
      //
      f.updateUser({ id: $.id, name: $.name })(({ f }) => [
        //
        f.id(),
        f.name(),
      })),
    }),
    ({ select }) =>
      select(["$.updateUser"], (result) => result.safeUnwrap(([payload]) => payload)),
  ),
);
```

### Step 3: Build queries and mutations

`operation.query` / `operation.mutation` stitch slices together behind a single operation name. The options object always takes `operationName` and (optionally) `variables`.

```typescript
// src/queries/profile.query.ts
import { gql } from "@/graphql-system";
import { userSlice } from "../slices/user.slice";

export const profileQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!"), $("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: userSlice.build({
        id: $.userId,
        categoryId: $.categoryId,
      }),
    }),
  ),
);
```

```typescript
// src/mutations/update-user.mutation.ts
import { gql } from "@/graphql-system";
import { updateUserSlice } from "../slices/user.slice";

export const updateUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateUser",
      variables: [$("id").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ $ }) => ({
      updateUser: updateUserSlice.build({
        id: $.id,
        name: $.name,
      }),
    }),
  ),
);
```

### Step 4: Execute and parse responses

Use the generated document and parser to run operations. After the Babel transform runs, the runtime replaces this call with `gqlRuntime.getOperation(...)` while preserving metadata.

```typescript
import { profileQuery } from "@/queries/profile.query";
import { graphqlClient } from "./client";

const executionResult = await graphqlClient({
  document: profileQuery.document,
  variables: { userId: "42", categoryId: null },
});

const data = profileQuery.parse(executionResult);
```

## Testing Models

```typescript
// src/models/__tests__/user.model.test.ts
import { describe, expect, test } from "bun:test";
import { userBasic } from "../user.model";

describe("userBasic model", () => {
  test("normalizes data", () => {
    const normalized = userBasic.normalize({ id: "1", name: "Ada Lovelace" });
    expect(normalized).toEqual({ id: "1", name: "Ada Lovelace" });
  });

  test("builds fragments", () => {
    const fragment = userBasic.fragment();
    expect(fragment.id).toBeDefined();
    expect(fragment.name).toBeDefined();
  });
});
```


## Build-time Optimization

**Before (development)**
```typescript
export const profileQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    { operationName: "ProfilePageQuery", variables: [$("userId").scalar("ID:!")] },
    ({ $ }) => ({
      users: userSlice.build({ id: $.userId }),
    }),
  ),
);
```

**After (production build)**
```typescript
import { gqlRuntime } from "@soda-gql/runtime";

export const profileQuery = gqlRuntime.getOperation("ProfilePageQuery");

gqlRuntime.operation({
  prebuild: JSON.parse("/* serialized metadata */"),
  runtime: {
    getSlices: ({ $ }) => ({
      users: userSlice.build({ id: $.userId }),
    }),
  },
});
```

## Common Patterns

```
src/
├── entities/
│   └── user/
│       ├── models/user.model.ts
│       └── slices/user.slice.ts
├── features/
│   └── profile/
│       ├── queries/profile.query.ts
│       └── mutations/update-user.mutation.ts
└── pages/
    └── profile/
        └── profile.page.ts
```

## Error Handling with neverthrow

```typescript
// src/slices/safe-user.slice.ts
import { err, ok } from "neverthrow";
import { gql } from "@/graphql-system";
import { userBasic } from "@/models/user.model";

export const safeUserSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.user({ id: $.id })(() => [
        //
        userBasic.fragment(),
      ]),
    ],
    ({ select }) =>
      select(["$.user"], (result) => {
        const outcome = result.safeUnwrap(([user]) => userBasic.normalize(user));
        if (outcome.error) {
          return err(outcome.error);
        }
        if (!outcome.data) {
          return err(new Error("User not found"));
        }
        return ok(outcome.data);
      }),
  ),
);

export const safeGetUserQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "SafeGetUser",
      variables: [$("id").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: safeUserSlice.build({ id: $.id }),
    }),
  ),
);
```

## Troubleshooting

### Type Errors in Generated Code

1. Ensure schema is up to date: `bunx soda-gql generate`
2. Check that TypeScript includes `graphql-system` directory
3. Restart TypeScript service in your IDE

### Models Not Being Transformed

1. Verify Babel plugin is configured correctly
2. Check that files are being processed by Babel
3. Enable verbose logging in plugin configuration

### Performance Issues

1. Use field selection carefully - avoid selecting entire schema
2. Implement pagination for list fields
3. Use model composition to reuse selections

## Next Steps

- Explore the type system in `docs/type-system.md`.
- Review composition patterns in `docs/models.md`.
- Check the migration guide in `docs/migration.md`.
