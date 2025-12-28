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
  query.operation({ name: "GetUser" }, ({ f }) => [
    f.user({ id: "1" })(userFragment.embed()),
  ]),
);
```

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
