# Quickstart: Zero-runtime GraphQL Query Generation

This guide demonstrates the basic usage of the zero-runtime GraphQL generation system through a practical example.

## Installation

```bash
# Install the core package and build plugin
bun add @soda-gql/core
bun add -D @soda-gql/plugin-babel  # Minimum requirement
bun add -D @soda-gql/plugin-bun    # Optional: Bun-specific optimizations

# Install peer dependencies
bun add zod neverthrow
```

**Note**: This initial version supports queries and mutations only. Subscriptions, directives, and native GraphQL fragments are not supported.

## Setup

### 1. Configure Build Plugin

Create or update your `bunfig.toml`:

```toml
preload = ["@soda-gql/plugin-bun"]

[plugin."@soda-gql/plugin-bun"]
schemaPath = "./schema.graphql"
systemDir = "./src/graphql-system"  # Generated system directory
```

### 2. Initialize Schema

Place your GraphQL schema file at the root:

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
  comments(limit: Int): [Comment!]!
}

type Comment {
  id: ID!
  text: String!
  author: User!
}

type Query {
  user(id: ID!): User
  users: [User!]!
  post(id: ID!): Post
}
```

### 3. Generate GraphQL System

```bash
bun run @soda-gql/core generate
```

This creates a `graphql-system/` directory (similar to PandaCSS's `styled-system/`) containing:

- Complete type definitions for all GraphQL types, inputs, scalars, and enums
- The `gql` API with proper TypeScript types
- React hooks and utilities (if configured)
- All necessary type information for IDE autocomplete

You import everything from this generated system rather than from the core package directly.

## Basic Usage

### Step 1: Define Remote Models

Create type-safe representations of your GraphQL types:

```typescript
// src/models/user.remote-model.ts
import { gql } from "@/graphql-system"; // Generated system includes all types

// Define a basic user model
export const userBasic = gql.model(
  "User",
  (relation) => ({
    // relation is available even in simple form
    id: true,
    name: true,
    email: true,
  }),
  (data) => ({
    id: data.id,
    displayName: data.name,
    email: data.email.toLowerCase(),
  })
);

// Define a detailed user model with posts
export const userWithPosts = gql.model(
  "User",
  (relation) => ({
    id: true,
    name: true,
    posts: {
      id: true,
      title: true,
    },
  }),
  (data) => ({
    id: data.id,
    name: data.name,
    postCount: data.posts.length,
    posts: data.posts.map((p) => ({
      id: p.id,
      title: p.title,
    })),
  })
);

// Export inferred types
export type UserBasic = gql.infer<typeof userBasic>;
export type UserWithPosts = gql.infer<typeof userWithPosts>;
```

### Step 2: Create Query Slices

Define domain-specific queries:

```typescript
// src/slices/user.slices.ts
import { gql } from "@/graphql-system";
import { userBasic, userWithPosts } from "../models/user.remote-model";

// Slice for fetching a single user
export const getUserSlice = gql.querySlice(
  ["getUser", { id: gql.arg.id() }],
  (query, args) => ({
    user: query(["user", { id: args.id }], userBasic),
  }),
  (data) => data?.user ?? null
);

// Slice for listing all users
export const listUsersSlice = gql.querySlice(
  "listUsers",
  (query) => ({
    users: query("users", userBasic),
  }),
  (data) => data?.users ?? []
);

// Slice for user with posts
export const getUserWithPostsSlice = gql.querySlice(
  ["getUserWithPosts", { id: gql.arg.id() }],
  (query, args) => ({
    user: query(["user", { id: args.id }], userWithPosts),
  }),
  (data) => data?.user ?? null
);
```

### Step 3: Compose Page Queries

Combine slices for specific pages:

```typescript
// src/pages/UserProfile.tsx
import { gql } from "@/graphql-system";
import { useQuery } from "@/graphql-system/react";
import { getUserWithPostsSlice } from "../slices/user.slices";

// Define the page query
const userProfileQuery = gql.query(
  ["UserProfile", { userId: gql.arg.id() }],
  (_, args) => ({
    user: getUserWithPostsSlice({ id: args.userId }),
  })
);

export function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(userProfileQuery, {
    variables: { userId },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data.user) return <div>User not found</div>;

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>Posts: {data.user.postCount}</p>
      <ul>
        {data.user.posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Advanced Features

### Parameterized Remote Models

Define models with injectable parameters:

```typescript
// src/models/post.remote-model.ts
import { gql } from "@/graphql-system";

export const postWithComments = gql.model(
  [
    "Post",
    {
      commentLimit: gql.arg.int(),
    },
  ],
  (relation, args) => ({
    id: true,
    title: true,
    content: true,
    comments: relation(["comments", { limit: args.commentLimit }], {
      id: true,
      text: true,
    }),
  }),
  (data) => ({
    id: data.id,
    title: data.title,
    content: data.content,
    commentCount: data.comments.length,
    recentComments: data.comments,
  })
);
```

### Cross-module Query Composition

Combine slices from different modules:

```typescript
// src/pages/Dashboard.tsx
import { gql } from "@/graphql-system";
import { listUsersSlice } from "../slices/user.slices";
import { recentPostsSlice } from "../slices/post.slices";
import { statsSlice } from "../slices/stats.slices";

const dashboardQuery = gql.query(["Dashboard", {}], (_) => ({
  users: listUsersSlice(),
  posts: recentPostsSlice({ limit: 10 }),
  stats: statsSlice(),
  // Note: Maximum 32 slices per query, warning at 16+
}));
```

## Testing

### Testing Remote Models

```typescript
// src/models/__tests__/user.remote-model.test.ts
import { describe, expect, test } from "bun:test";
import { userBasic } from "../user.remote-model";

describe("userBasic remote model", () => {
  test("transforms data correctly", () => {
    const input = {
      id: "1",
      name: "John Doe",
      email: "JOHN@EXAMPLE.COM",
    };

    const result = userBasic.transform(input);

    expect(result).toEqual({
      id: "1",
      displayName: "John Doe",
      email: "john@example.com",
    });
  });

  test("selects correct fields", () => {
    const fields = userBasic.fields();

    expect(fields).toEqual({
      id: true,
      name: true,
      email: true,
    });
  });
});
```

### Testing Query Slices

```typescript
// src/slices/__tests__/user.slices.test.ts
import { describe, expect, test } from "bun:test";
import { getUserSlice } from "../user.slices";

describe("getUserSlice", () => {
  test("handles null response", () => {
    const result = getUserSlice.transform({ user: null });
    expect(result).toBeNull();
  });

  test("transforms user data", () => {
    const result = getUserSlice.transform({
      user: {
        id: "1",
        name: "John",
        email: "john@example.com",
      },
    });

    expect(result).toEqual({
      id: "1",
      displayName: "John",
      email: "john@example.com",
    });
  });
});
```

## Build Verification

After setup, verify the build process:

```bash
# Run build to trigger transformations
bun run build

# Check generated files
ls -la src/__generated__/

# Verify type checking
bun run typecheck

# Run tests
bun test
```

## Common Patterns

### 1. Feature-Sliced Design Integration

Organize by features:

```
src/
├── entities/
│   └── user/
│       ├── models/
│       │   └── user.remote-model.ts
│       └── slices/
│           └── user.slices.ts
├── features/
│   └── auth/
│       └── slices/
│           └── auth.slices.ts
└── pages/
    └── profile/
        └── profile.query.ts
```

### 2. Error Handling

Transform functions propagate errors as runtime exceptions:

```typescript
export const userSlice = gql.querySlice(
  ["getUser", { id: gql.arg.id() }],
  (query, args) => ({
    user: query(["user", { id: args.id }], userBasic),
  }),
  (data) => {
    if (!data?.user) {
      throw new Error("User not found");
    }
    return userBasic.transform(data.user);
  }
);
```

### 3. Optimistic Updates

Support optimistic UI updates:

```typescript
const updateUserMutation = gql.mutation(
  ["UpdateUser", { id: gql.arg.id(), name: gql.arg.string() }],
  (mutate, args) => ({
    updateUser: mutate("updateUser", args, userBasic),
  })
);

// Usage with optimistic response
const [updateUser] = useMutation(updateUserMutation, {
  optimisticResponse: {
    updateUser: {
      id: userId,
      name: newName,
    },
  },
});
```

## Troubleshooting

### Type Errors Not Appearing

1. Ensure the plugin is loaded in `bunfig.toml`
2. Restart the TypeScript service
3. Check that `tsconfig.json` includes generated files

### Queries Not Being Transformed

1. Verify file extensions match plugin config
2. Check for syntax errors in GraphQL schema
3. Review build logs with `verbose: true`

### Performance Issues

1. Enable caching in plugin config
2. Reduce `maxParallel` if memory constrained
3. Use shallow analysis for large codebases

## Next Steps

- Explore [Advanced Remote Models](./docs/remote-models.md)
- Learn about [Query Optimization](./docs/optimization.md)
- Read the [Migration Guide](./docs/migration.md) from graphql-codegen
- Check out [Integration Examples](./examples/)
