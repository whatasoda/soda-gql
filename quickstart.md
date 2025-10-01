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

### 1. Initialize Project

```bash
# Generate initial configuration
bunx soda-gql init

# This creates:
# - soda-gql.config.ts with schema path configuration
# - Updates package.json with generation scripts
```

### 2. Configure Your Schema

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

### 3. Prepare Scalars and Adapter

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

### 4. Generate GraphQL System

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

### Step 1: Define Models with New API

Create type-safe models using the generated system:

```typescript
// src/models/user.model.ts
import { gql } from "@/graphql-system";

// Basic user model with field selection
export const userBasic = gql.model(
  "User",  // Target type from schema
  ({ fields }) => ({
    ...fields.id(),
    ...fields.name(),
    ...fields.email(),
  }),
  // Transform function for data normalization
  (data) => ({
    id: data.id,
    displayName: data.name,
    email: data.email.toLowerCase(),
  })
);

// User with nested posts selection
export const userWithPosts = gql.model(
  "User",
  ({ fields }) => ({
    ...fields.id(),
    ...fields.name(),
    ...fields.posts(
      {},  // No arguments for posts field
      gql.inlineModel("Post", ({ fields }) => ({
        ...fields.id(),
        ...fields.title(),
      }))
    ),
  }),
  (data) => ({
    id: data.id,
    name: data.name,
    postCount: data.posts.length,
    posts: data.posts.map(p => ({
      id: p.id,
      title: p.title,
    })),
  })
);

// Export inferred types
export type UserBasic = gql.infer<typeof userBasic>;
export type UserWithPosts = gql.infer<typeof userWithPosts>;
```

### Step 2: Models with Parameters

Define models that accept runtime parameters:

```typescript
// src/models/post.model.ts
import { gql } from "@/graphql-system";
import { userBasic } from "./user.model";

// Post model with parameterized comments
export const postWithComments = gql.model(
  [
    "Post",
    {
      // Define variables for this model
      commentLimit: gql.input.fromTypeField("Post", "comments", "limit"),
      commentOffset: gql.input.fromTypeField("Post", "comments", "offset"),
    }
  ],
  ({ fields, variables }) => ({
    ...fields.id(),
    ...fields.title(),
    ...fields.content(),
    ...fields.author({}, userBasic),
    ...fields.comments(
      {
        limit: variables.commentLimit,
        offset: variables.commentOffset,
      },
      gql.inlineModel("Comment", ({ fields }) => ({
        ...fields.id(),
        ...fields.content(),
        ...fields.createdAt(),
        ...fields.author({}, userBasic),
      }))
    ),
  }),
  (data) => ({
    id: data.id,
    title: data.title,
    content: data.content,
    author: data.author,
    comments: data.comments.map(c => ({
      ...c,
      author: c.author,
    })),
    hasMoreComments: data.comments.length === 10, // Assuming limit was 10
  })
);

export type PostWithComments = gql.infer<typeof postWithComments>;
```

### Step 3: Create Queries

Compose models into executable queries:

```typescript
// src/queries/user.queries.ts
import { gql } from "@/graphql-system";
import { userBasic, userWithPosts } from "../models/user.model";

// Simple query without variables
export const listUsersQuery = gql.query(
  "ListUsers",
  ({ query }) => ({
    users: query.users({}, userBasic),
  }),
  (data) => data.users
);

// Query with variables
export const getUserQuery = gql.query(
  ["GetUser", { id: gql.input.scalar("ID", "!") }],
  ({ query, variables }) => ({
    user: query.user({ id: variables.id }, userWithPosts),
  }),
  (data) => data.user
);

// Export types
export type ListUsersResult = gql.infer<typeof listUsersQuery>;
export type GetUserResult = gql.infer<typeof getUserQuery>;
```

### Step 4: Create Mutations

Define mutations with the same pattern:

```typescript
// src/mutations/post.mutations.ts
import { gql } from "@/graphql-system";
import { postWithComments } from "../models/post.model";

export const createPostMutation = gql.mutation(
  [
    "CreatePost",
    {
      title: gql.input.scalar("String", "!"),
      content: gql.input.scalar("String", "!"),
    }
  ],
  ({ mutation, variables }) => ({
    post: mutation.createPost(
      {
        title: variables.title,
        content: variables.content,
      },
      postWithComments
    ),
  }),
  (data) => data.post
);

export const updatePostMutation = gql.mutation(
  [
    "UpdatePost",
    {
      id: gql.input.scalar("ID", "!"),
      title: gql.input.scalar("String", "?"),
      content: gql.input.scalar("String", "?"),
    }
  ],
  ({ mutation, variables }) => ({
    post: mutation.updatePost(
      {
        id: variables.id,
        title: variables.title,
        content: variables.content,
      },
      postWithComments
    ),
  }),
  (data) => data.post
);
```

## Using with React (Example)

```typescript
// src/components/UserProfile.tsx
import { useQuery } from "@apollo/client"; // Or your GraphQL client
import { getUserQuery } from "../queries/user.queries";

export function UserProfile({ userId }: { userId: string }) {
  // The query is fully typed
  const { data, loading, error } = useQuery(getUserQuery.document, {
    variables: { id: userId },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  // Transform the data using the query's transform function
  const user = getUserQuery.transform(data);
  
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Posts: {user.postCount}</p>
      <ul>
        {user.posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Advanced Patterns

### Composing Multiple Models

```typescript
// src/models/composite.model.ts
import { gql } from "@/graphql-system";
import { userBasic } from "./user.model";
import { postWithComments } from "./post.model";

// Dashboard query combining multiple root queries
export const dashboardQuery = gql.query(
  "Dashboard",
  ({ query }) => ({
    currentUser: query.user({ id: "me" }, userBasic),
    recentPosts: query.posts(
      { limit: 5, offset: 0 },
      postWithComments
    ),
    allUsers: query.users({}, userBasic),
  }),
  (data) => ({
    user: data.currentUser,
    posts: data.recentPosts,
    users: data.allUsers,
    stats: {
      userCount: data.allUsers.length,
      postCount: data.recentPosts.length,
    }
  })
);
```

### Union Type Handling

```typescript
// src/models/search.model.ts
import { gql } from "@/graphql-system";

// Assuming a SearchResult union type in schema
export const searchResultModel = gql.model(
  "SearchResult", // Union type
  ({ fields }) => ({
    // Define selections for each possible type
    ...gql.inlineModel("User", ({ fields }) => ({
      ...fields.id(),
      ...fields.name(),
      __typename: "User" as const,
    })),
    ...gql.inlineModel("Post", ({ fields }) => ({
      ...fields.id(),
      ...fields.title(),
      __typename: "Post" as const,
    })),
    ...gql.inlineModel("Comment", ({ fields }) => ({
      ...fields.id(),
      ...fields.content(),
      __typename: "Comment" as const,
    })),
  }),
  (data) => {
    // Type-safe discrimination based on __typename
    switch (data.__typename) {
      case "User":
        return { type: "user", id: data.id, name: data.name };
      case "Post":
        return { type: "post", id: data.id, title: data.title };
      case "Comment":
        return { type: "comment", id: data.id, content: data.content };
    }
  }
);
```

## Testing

### Testing Models

```typescript
// src/models/__tests__/user.model.test.ts
import { describe, expect, test } from "bun:test";
import { userBasic } from "../user.model";

describe("userBasic model", () => {
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
    // The fields property contains the selection structure
    expect(userBasic.fields).toBeDefined();
    expect(userBasic.typeName).toBe("User");
  });
});
```

## Build-time Optimization

When using the Babel plugin, your runtime calls are transformed:

**Before (Development)**:
```typescript
const query = gql.query("GetUser", ({ query }) => ({
  user: query.user({ id: "1" }, userBasic)
}));
```

**After (Production Build)**:
```typescript
const query = {
  document: /* Generated GraphQL document */,
  transform: /* Preserved transform function */,
  variables: { id: "1" }
};
```

## Common Patterns

### Feature-Sliced Design Integration

```
src/
├── entities/
│   ├── user/
│   │   └── models/
│   │       └── user.model.ts
│   ├── post/
│   │   └── models/
│   │       └── post.model.ts
│   └── comment/
│       └── models/
│           └── comment.model.ts
├── features/
│   ├── auth/
│   │   └── queries/
│   │       └── auth.queries.ts
│   └── posts/
│       ├── queries/
│       │   └── post.queries.ts
│       └── mutations/
│           └── post.mutations.ts
└── pages/
    └── dashboard/
        └── dashboard.query.ts
```

### Error Handling with neverthrow

```typescript
import { Result, ok, err } from "neverthrow";

export const safeGetUserQuery = gql.query(
  ["GetUser", { id: gql.input.scalar("ID", "!") }],
  ({ query, variables }) => ({
    user: query.user({ id: variables.id }, userBasic),
  }),
  (data): Result<UserBasic, Error> => {
    if (!data.user) {
      return err(new Error("User not found"));
    }
    return ok(userBasic.transform(data.user));
  }
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

- Explore the [Type System Documentation](./docs/type-system.md)
- Learn about [Model Composition Patterns](./docs/models.md)
- Read the [Migration Guide](./docs/migration.md) from traditional GraphQL codegen
- Check out [Example Projects](./examples/)
