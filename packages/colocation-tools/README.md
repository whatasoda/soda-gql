# @soda-gql/colocation-tools

Utilities for colocating GraphQL fragments with components in soda-gql. This package provides tools for fragment composition and data masking patterns.

## Features

- **Fragment colocation** - Keep GraphQL fragments close to components that use them
- **Data projection** - Create typed projections from fragment data
- **Type safety** - Full TypeScript support for fragment composition

## Installation

```bash
npm install @soda-gql/colocation-tools
# or
bun add @soda-gql/colocation-tools
```

## Usage

### Fragment Colocation Pattern

```typescript
import { createProjection, createExecutionResultParser } from "@soda-gql/colocation-tools";
import { userFragment } from "./graphql-system";

// Create a projection with paths and handle function
const userProjection = createProjection(userFragment, {
  paths: ["$.user.id", "$.user.name"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, user: null };
    if (result.isEmpty()) return { error: null, user: null };
    const data = result.unwrap();
    return { error: null, user: data };
  },
});

// Use with execution result parser
const parser = createExecutionResultParser({
  user: userProjection,
});
```

### Embedding Fragments

Fragments can be embedded in operations:

```typescript
import { gql } from "./graphql-system";
import { userFragment } from "./UserCard";

export const getUserQuery = gql.default(({ query }) =>
  query.operation({
    name: "GetUser",
    fields: ({ f }) => ({ ...f.user({ id: "1" })(({ f }) => ({ ...userFragment.embed() })) }),
  }),
);
```

### Using with $colocate

When composing multiple fragments in a single operation, use `$colocate` to prefix field selections with labels. The `createExecutionResultParser` will use these same labels to extract the corresponding data.

#### Complete Workflow

**Step 1: Define component fragments**

```typescript
// UserCard.tsx
export const userCardFragment = gql.default(({ fragment }, { $var }) =>
  fragment.Query({
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id(), ...f.name(), ...f.email() })) }),
  }),
);

export const userCardProjection = createProjection(userCardFragment, {
  paths: ["$.user"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, user: null };
    if (result.isEmpty()) return { error: null, user: null };
    return { error: null, user: result.unwrap().user };
  },
});
```

**Step 2: Compose operation with $colocate**

```typescript
// UserPage.tsx
import { userCardFragment, userCardProjection } from "./UserCard";
import { postListFragment, postListProjection } from "./PostList";

export const userPageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation({
    name: "UserPage",
    variables: { ...$var("userId").ID("!") },
    fields: ({ $ }) => $colocate({
      userCard: userCardFragment.embed({ userId: $.userId }),
      postList: postListFragment.embed({ userId: $.userId }),
    }),
  }),
);
```

**Step 3: Create parser with matching labels**

```typescript
const parseUserPageResult = createExecutionResultParser({
  userCard: userCardProjection,
  postList: postListProjection,
});
```

**Step 4: Parse execution result**

```typescript
const result = await executeQuery(userPageQuery);
const { userCard, postList } = parseUserPageResult(result);
// userCard and postList contain the projected data
```

The labels in `$colocate` (`userCard`, `postList`) must match the labels in `createExecutionResultParser` for proper data routing.

## API

### createProjection

Creates a typed projection from a fragment definition with specified paths and handler.

```typescript
import { createProjection } from "@soda-gql/colocation-tools";

const projection = createProjection(fragment, {
  // Field paths to extract (must start with "$.")
  paths: ["$.user.id", "$.user.name"],
  // Handler to transform the sliced result
  handle: (result) => {
    if (result.isError()) return { error: result.error, data: null };
    if (result.isEmpty()) return { error: null, data: null };
    return { error: null, data: result.unwrap() };
  },
});
```

### createProjectionAttachment

Combines fragment definition and projection into a single export using `attach()`. This eliminates the need for separate projection definitions.

```typescript
import { createProjectionAttachment } from "@soda-gql/colocation-tools";
import { gql } from "./graphql-system";

export const postListFragment = gql
  .default(({ fragment }, { $var }) =>
    fragment.Query({
      variables: { ...$var("userId").ID("!") },
      fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.posts({})(({ f }) => ({ ...f.id(), ...f.title() })) })) }),
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user.posts"],
      handle: (result) => {
        if (result.isError()) return { error: result.error, posts: null };
        if (result.isEmpty()) return { error: null, posts: null };
        return { error: null, posts: result.unwrap().user?.posts ?? [] };
      },
    }),
  );

// The fragment now has a .projection property
postListFragment.projection;
```

**Benefits**:
- Single export for both fragment and projection
- Fragment can be passed directly to `createExecutionResultParser`
- Reduces boilerplate when projection logic is simple

**Using with createExecutionResultParser**:

```typescript
const parseResult = createExecutionResultParser({
  userCard: { projection: userCardProjection }, // Explicit projection
  postList: postListFragment,                    // Fragment with attached projection
});
```

Both patterns work with the parser - it automatically detects fragments with attached projections.

### createExecutionResultParser

Creates a parser from labeled projections to process GraphQL execution results.

```typescript
import { createExecutionResultParser } from "@soda-gql/colocation-tools";

const parser = createExecutionResultParser({
  userData: userProjection,
  postsData: postsProjection,
});

const results = parser(executionResult);
// results.userData, results.postsData
```

## Related Packages

- [@soda-gql/core](../core) - Core types and fragment definitions
- [@soda-gql/runtime](../runtime) - Runtime operation handling

## License

MIT
