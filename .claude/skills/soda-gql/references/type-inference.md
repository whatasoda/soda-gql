# Type Inference Guide

Advanced patterns for extracting and using TypeScript types from soda-gql definitions.

## Basic Type Extraction

### $infer Property

All soda-gql elements expose a `$infer` property for type extraction:

```typescript
import { gql } from "@/graphql-system";

export const userFragment = gql.default(/* ... */);
export const getUserQuery = gql.default(/* ... */);

// Extract types
type FragmentInput = typeof userFragment.$infer.input;
type FragmentOutput = typeof userFragment.$infer.output;

type QueryVariables = typeof getUserQuery.$infer.input;
type QueryResult = typeof getUserQuery.$infer.output.projected;
```

## Fragment Types

### Input Type

Variables required by the fragment:

```typescript
const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: {
      ...$var("includeEmail").Boolean("?"),
      ...$var("postLimit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email({ if: $.includeEmail }),
    }),
  }),
);

type UserFragmentInput = typeof userFragment.$infer.input;
// { includeEmail?: boolean; postLimit?: number }
```

### Output Type

Fields selected by the fragment:

```typescript
type UserFragmentOutput = typeof userFragment.$infer.output;
// { id: string; name: string; email?: string }
```

## Operation Types

### Input Type (Variables)

Variables required by the operation:

```typescript
const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: {
      ...$var("userId").ID("!"),
      ...$var("includeEmail").Boolean("?"),
    },
    fields: ({ f, $ }) => ({ /* ... */ }),
  }),
);

type GetUserVariables = typeof getUserQuery.$infer.input;
// { userId: string; includeEmail?: boolean }
```

### Output Type

Full output type:

```typescript
type GetUserOutput = typeof getUserQuery.$infer.output;
```

### Projected Output Type

Only the selected fields (most commonly used):

```typescript
type GetUserResult = typeof getUserQuery.$infer.output.projected;
// { user: { id: string; name: string; email?: string } | null }
```

## Usage Patterns

### With Fetch Functions

```typescript
async function getUser(
  variables: typeof getUserQuery.$infer.input
): Promise<typeof getUserQuery.$infer.output.projected> {
  const response = await fetch("/graphql", {
    method: "POST",
    body: JSON.stringify({
      query: getUserQuery.document,
      variables,
    }),
  });
  const { data } = await response.json();
  return data;
}

// Usage
const result = await getUser({ userId: "123" });
result.user?.name; // Fully typed
```

### With React Query

```typescript
import { useQuery } from "@tanstack/react-query";

function useGetUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async (): Promise<typeof getUserQuery.$infer.output.projected> => {
      const response = await graphqlClient.request(
        getUserQuery.document,
        { userId }
      );
      return response;
    },
  });
}

// Usage
const { data } = useGetUser("123");
data?.user?.name; // Fully typed
```

### With Apollo Client

```typescript
import { useQuery } from "@apollo/client";
import { gql as apolloGql } from "@apollo/client";

function useGetUser(userId: string) {
  return useQuery<
    typeof getUserQuery.$infer.output.projected,
    typeof getUserQuery.$infer.input
  >(apolloGql(getUserQuery.document), {
    variables: { userId },
  });
}
```

### With urql

```typescript
import { useQuery } from "urql";

function useGetUser(userId: string) {
  const [result] = useQuery<
    typeof getUserQuery.$infer.output.projected,
    typeof getUserQuery.$infer.input
  >({
    query: getUserQuery.document,
    variables: { userId },
  });
  return result;
}
```

## Type Utilities

### Creating Reusable Types

```typescript
// types.ts
import type { getUserQuery, userFragment } from "./operations";

export type User = typeof userFragment.$infer.output;
export type GetUserVariables = typeof getUserQuery.$infer.input;
export type GetUserResult = typeof getUserQuery.$infer.output.projected;
```

### Extracting Nested Types

```typescript
const getUsersQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUsers",
    variables: { ...$var("ids").ID("![]!") },
    fields: ({ f, $ }) => ({
      ...f.users({ ids: $.ids })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.posts()(({ f }) => ({
          ...f.id(),
          ...f.title(),
        })),
      })),
    }),
  }),
);

type GetUsersResult = typeof getUsersQuery.$infer.output.projected;
// { users: Array<{ id: string; name: string; posts: Array<{ id: string; title: string }> }> }

// Extract user type from result
type User = GetUsersResult["users"][number];
// { id: string; name: string; posts: Array<{ id: string; title: string }> }

// Extract post type
type Post = User["posts"][number];
// { id: string; title: string }
```

## Conditional Types

### Handling Nullable Fields

```typescript
type GetUserResult = typeof getUserQuery.$infer.output.projected;
// { user: { ... } | null }

// Extract non-null user type
type User = NonNullable<GetUserResult["user"]>;
```

### Union Type Handling

For GraphQL unions/interfaces:

```typescript
const searchQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "Search",
    variables: { ...$var("query").String("!") },
    fields: ({ f, $ }) => ({
      ...f.search({ query: $.query })(({ f }) => ({
        ...f.__typename(),
        ...f.on_User(({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
        ...f.on_Post(({ f }) => ({
          ...f.id(),
          ...f.title(),
        })),
      })),
    }),
  }),
);

type SearchResult = typeof searchQuery.$infer.output.projected;
type SearchItem = SearchResult["search"][number];
// { __typename: "User"; id: string; name: string } | { __typename: "Post"; id: string; title: string }
```

## Generic Patterns

### Type-Safe Query Function Factory

```typescript
function createQueryFn<T extends { document: string; $infer: { input: any; output: { projected: any } } }>(
  operation: T
) {
  return async (variables: T["$infer"]["input"]): Promise<T["$infer"]["output"]["projected"]> => {
    const response = await fetch("/graphql", {
      method: "POST",
      body: JSON.stringify({ query: operation.document, variables }),
    });
    const { data } = await response.json();
    return data;
  };
}

// Usage
const getUser = createQueryFn(getUserQuery);
const result = await getUser({ userId: "123" }); // Fully typed
```

### Type-Safe Hook Factory

```typescript
function useGraphQLQuery<T extends { document: string; $infer: { input: any; output: { projected: any } } }>(
  operation: T,
  variables: T["$infer"]["input"]
) {
  // Implementation with React Query, SWR, etc.
  return useQuery<T["$infer"]["output"]["projected"]>({
    queryKey: [operation.document, variables],
    queryFn: () => graphqlClient.request(operation.document, variables),
  });
}

// Usage
const { data } = useGraphQLQuery(getUserQuery, { userId: "123" });
data?.user?.name; // Fully typed
```
