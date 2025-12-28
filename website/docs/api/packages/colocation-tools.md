# @soda-gql/colocation-tools

Utilities for the fragment colocation pattern. This package provides projection creation and execution result parsing.

## Installation

```bash
bun add @soda-gql/colocation-tools
```

## Overview

This package enables the fragment colocation pattern by providing:

- **Projections**: Define how to extract data from execution results
- **Result Parsing**: Route data and errors to the correct fragments
- **Type Safety**: Full TypeScript inference for all operations

See the [Fragment Colocation Guide](/guide/colocation) for usage patterns.

## createProjection()

Create a projection for extracting data from a fragment:

```typescript
import { createProjection } from "@soda-gql/colocation-tools";

const userProjection = createProjection(userFragment, {
  paths: ["$.user"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, user: null };
    if (result.isEmpty()) return { error: null, user: null };
    return { error: null, user: result.unwrap().user };
  },
});
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `fragment` | `Fragment` | The fragment to create a projection for |
| `options.paths` | `string[]` | Field paths to extract (e.g., `["$.user"]`) |
| `options.handle` | `function` | Handler for the sliced result |

### Return Type

Returns a `Projection<TProjected>` object with:

- `paths`: Array of `ProjectionPath` objects
- `projector`: Function that transforms `SlicedExecutionResult` to output

## createProjectionAttachment()

Create an attachment for use with fragment's `attach()` method:

```typescript
import { createProjectionAttachment } from "@soda-gql/colocation-tools";

export const userFragment = gql
  .default(({ fragment }) =>
    fragment.User({}, ({ f }) => [f.id(), f.name()])
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user"],
      handle: (result) => result.safeUnwrap((data) => data.user),
    }),
  );

// Access via fragment.projection
userFragment.projection.projector(slicedResult);
```

### Benefits

- Single export for fragment + projection
- Fragment can be passed directly to `createExecutionResultParser`
- Cleaner component code

## createExecutionResultParser()

Create a parser for composed operations with multiple fragments:

```typescript
import { createExecutionResultParser } from "@soda-gql/colocation-tools";

const parseResult = createExecutionResultParser({
  userCard: userCardFragment,
  postList: postListFragment,
});

// Parse execution result
const { userCard, postList } = parseResult(graphqlResponse);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slices` | `object` | Map of labels to fragments with projections |

### How It Works

1. Builds a projection path graph from all fragment paths
2. Routes GraphQL errors to the correct labels based on error paths
3. Extracts data for each label using prefixed path segments
4. Invokes each projection's handler with the sliced result

## SlicedExecutionResult

The result type passed to projection handlers. Three possible states:

### SlicedExecutionResultSuccess

Data was extracted successfully:

```typescript
interface SlicedExecutionResultSuccess<TData> {
  isSuccess(): true;
  isError(): false;
  isEmpty(): false;

  // Get the typed data
  unwrap(): TData;

  // Safe unwrap with transform
  safeUnwrap<T>(transform: (data: TData) => T): {
    data: T;
    error: undefined;
  };
}
```

### SlicedExecutionResultError

An error occurred:

```typescript
interface SlicedExecutionResultError<TData> {
  isSuccess(): false;
  isError(): true;
  isEmpty(): false;

  // The normalized error
  error: NormalizedError;

  // Throws the error
  unwrap(): never;

  // Returns error without throwing
  safeUnwrap(): {
    data: undefined;
    error: NormalizedError;
  };
}
```

### SlicedExecutionResultEmpty

No data or error (null result):

```typescript
interface SlicedExecutionResultEmpty<TData> {
  isSuccess(): false;
  isError(): false;
  isEmpty(): true;

  // Returns null
  unwrap(): null;

  // Returns empty result
  safeUnwrap(): {
    data: undefined;
    error: undefined;
  };
}
```

## NormalizedError

Error types that can appear in `SlicedExecutionResultError`:

```typescript
type NormalizedError =
  | { type: "graphql-error"; errors: GraphQLError[] }
  | { type: "non-graphql-error"; error: unknown }
  | { type: "parse-error"; error: unknown };
```

## NormalizedExecutionResult

Input type for the execution result parser:

```typescript
type NormalizedExecutionResult<TData, TExtensions> =
  | { type: "empty" }
  | {
      type: "graphql";
      body: {
        data?: TData;
        errors?: GraphQLError[];
        extensions?: TExtensions;
      };
    }
  | { type: "non-graphql-error"; error: unknown };
```

## ProjectionPath

Represents a parsed field path:

```typescript
interface ProjectionPath {
  full: string;      // "$.user.posts"
  segments: string[]; // ["user", "posts"]
}
```

## Projection Class

The projection object returned by `createProjection`:

```typescript
interface Projection<TProjected> {
  paths: ProjectionPath[];
  projector: (result: AnySlicedExecutionResult) => TProjected;
  $infer: { output: TProjected };
}
```

## Complete Example

```typescript
import { gql } from "@/graphql-system";
import {
  createProjectionAttachment,
  createExecutionResultParser,
} from "@soda-gql/colocation-tools";

// Define fragment with projection
export const userCardFragment = gql
  .default(({ fragment }, { $var }) =>
    fragment.Query(
      { variables: [$var("userId").scalar("ID:!")] },
      ({ f, $ }) => [
        f.user({ id: $.userId })(({ f }) => [f.id(), f.name()]),
      ],
    ),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user"],
      handle: (result) => {
        const { data, error } = result.safeUnwrap((d) => d.user);
        return { user: data ?? null, error: error ?? null };
      },
    }),
  );

// Compose in operation
export const pageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation(
    { name: "Page", variables: [$var("userId").scalar("ID:!")] },
    ({ $ }) => [
      $colocate({
        userCard: userCardFragment.embed({ userId: $.userId }),
      }),
    ],
  ),
);

// Create parser
const parsePageResult = createExecutionResultParser({
  userCard: userCardFragment,
});

// Usage
const response = await fetch("/graphql", { ... });
const { userCard } = parsePageResult(await response.json());

if (userCard.error) {
  console.error(userCard.error);
} else {
  console.log(userCard.user?.name);
}
```
