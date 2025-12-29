# Fragment Colocation

Fragment colocation is a pattern where GraphQL fragments are defined alongside the components that use them. soda-gql provides powerful tools for this pattern with type-safe data projection.

## How soda-gql Colocation Differs from GraphQL

Standard GraphQL colocation (e.g., with Relay or Apollo) uses fragment spreads:

```graphql
# UserCard.graphql
fragment UserCardFragment on User {
  id
  name
  avatarUrl
}

# Parent query
query UserPage($id: ID!) {
  user(id: $id) {
    ...UserCardFragment
    ...PostListFragment
  }
}
```

soda-gql takes a different approach:

| Aspect | Traditional GraphQL | soda-gql |
|--------|---------------------|----------|
| **Composition** | Fragment spread `...Name` | `$colocate({ label: fragment.embed() })` |
| **Labeling** | Implicit by fragment name | Explicit labels for each slice |
| **Data Extraction** | Manual traversal | `createExecutionResultParser` with projections |
| **Error Handling** | Manual per-fragment | Built-in `SlicedExecutionResult` with Success/Error/Empty states |
| **Type Safety** | Requires codegen | Full inference with `Projection` types |

:::tip
The `$colocate` helper with explicit labels enables soda-gql to route data and errors to the correct fragment handlers automatically.
:::

## The Colocation Workflow

### Step 1: Define Component Fragment with Projection

Each component defines its fragment and attaches a projection for data extraction:

```typescript
// UserCard.tsx
import { gql } from "@/graphql-system";
import { createProjectionAttachment } from "@soda-gql/colocation-tools";

export const userCardFragment = gql
  .default(({ fragment }, { $var }) =>
    fragment.Query({
      variables: [$var("userId").scalar("ID:!")],
      fields: ({ f, $ }) => [
        //
        f.user({ id: $.userId })(({ f }) => [
          //
          f.id(),
          f.name(),
          f.avatarUrl(),
        ]),
      ],
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user"],
      handle: (result) => {
        if (result.isError()) {
          return { error: result.error, user: null };
        }
        if (result.isEmpty()) {
          return { error: null, user: null };
        }
        return { error: null, user: result.unwrap().user };
      },
    }),
  );

// Component using the fragment data
export function UserCard({
  data,
}: {
  data: ReturnType<typeof userCardFragment.projection.projector>;
}) {
  if (data.error) return <ErrorDisplay error={data.error} />;
  if (!data.user) return <Loading />;
  return <div>{data.user.name}</div>;
}
```

### Step 2: Compose Fragments in Parent Operation

Use `$colocate` to combine multiple fragments with explicit labels:

```typescript
// UserPage.tsx
import { gql } from "@/graphql-system";
import { userCardFragment } from "./UserCard";
import { postListFragment } from "./PostList";

export const userPageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation({
    name: "UserPage",
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ $ }) => [
      //
      $colocate({
        userCard: userCardFragment.embed({ userId: $.userId }),
        postList: postListFragment.embed({ userId: $.userId }),
      }),
    ],
  }),
);
```

### Step 3: Create Result Parser

Create a parser that routes data to each fragment's projection:

```typescript
import { createExecutionResultParser } from "@soda-gql/colocation-tools";

const parseUserPageResult = createExecutionResultParser({
  userCard: userCardFragment,
  postList: postListFragment,
});
```

### Step 4: Execute and Distribute Data

Execute the query and distribute results to components:

```typescript
// In your page component
async function UserPage({ userId }: { userId: string }) {
  const response = await graphqlClient({
    document: userPageQuery.document,
    variables: { userId },
  });

  const { userCard, postList } = parseUserPageResult(response);

  return (
    <div>
      <UserCard data={userCard} />
      <PostList data={postList} />
    </div>
  );
}
```

## Projections

Projections define how to extract and transform data from execution results.

### createProjectionAttachment

Attach a projection directly to a fragment:

```typescript
import { createProjectionAttachment } from "@soda-gql/colocation-tools";

const fragment = gql
  .default(({ fragment }) =>
    fragment.Query({
      fields: ({ f }) => [
        //
        f.user({ id: "1" })(({ f }) => [
          //
          f.id(),
          f.name(),
        ]),
      ],
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user"],
      handle: (result) => {
        // Transform the sliced result
        if (result.isError()) return { error: result.error };
        if (result.isEmpty()) return { data: null };
        return { data: result.unwrap().user };
      },
    }),
  );
```

### Projection Paths

Paths specify which parts of the result to extract:

```typescript
paths: ["$.user"]           // Extract user field
paths: ["$.user.posts"]     // Extract nested field
paths: ["$.user", "$.meta"] // Extract multiple fields
```

Path format:
- Always start with `$.`
- Use dot notation for nested fields
- The first path segment maps to the `$colocate` label

## SlicedExecutionResult

The `handle` function receives a `SlicedExecutionResult`, which can be one of three states:

### Success

Data was extracted successfully:

```typescript
handle: (result) => {
  if (result.isSuccess()) {
    const data = result.unwrap(); // Get typed data
    return { data };
  }
  // ...
}
```

### Error

An error occurred (GraphQL error, network error, or parse error):

```typescript
handle: (result) => {
  if (result.isError()) {
    const error = result.error; // NormalizedError
    return { error, data: null };
  }
  // ...
}
```

### Empty

No data or error (null result):

```typescript
handle: (result) => {
  if (result.isEmpty()) {
    return { data: null };
  }
  // ...
}
```

### Safe Unwrapping

Use `safeUnwrap` for convenient error handling:

```typescript
handle: (result) => {
  const { data, error } = result.safeUnwrap((user) => ({
    formatted: user.name.toUpperCase(),
  }));

  return { data, error };
}
```

## Error Routing

The `createExecutionResultParser` automatically routes GraphQL errors to the correct fragments based on the error's path:

```typescript
// If the GraphQL response contains:
{
  "data": { "userCard_user": null },
  "errors": [{
    "message": "User not found",
    "path": ["userCard_user"]
  }]
}

// The error is routed to the userCard projection:
const { userCard } = parseResult(response);
userCard.error; // Contains the "User not found" error
```

## Complete Example

```typescript
// fragments/UserCard.ts
import { gql } from "@/graphql-system";
import { createProjectionAttachment } from "@soda-gql/colocation-tools";

export const userCardFragment = gql
  .default(({ fragment }, { $var }) =>
    fragment.Query({
      variables: [$var("id").scalar("ID:!")],
      fields: ({ f, $ }) => [
        //
        f.user({ id: $.id })(({ f }) => [
          //
          f.id(),
          f.name(),
          f.email(),
        ]),
      ],
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user"],
      handle: (result) => result.safeUnwrap((data) => data.user),
    }),
  );

// fragments/PostList.ts
export const postListFragment = gql
  .default(({ fragment }, { $var }) =>
    fragment.Query({
      variables: [
        //
        $var("userId").scalar("ID:!"),
        $var("limit").scalar("Int:?"),
      ],
      fields: ({ f, $ }) => [
        //
        f.user({ id: $.userId })(({ f }) => [
          //
          f.posts({ limit: $.limit })(({ f }) => [
            //
            f.id(),
            f.title(),
          ]),
        ]),
      ],
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user.posts"],
      handle: (result) => result.safeUnwrap((data) => data.user?.posts ?? []),
    }),
  );

// pages/UserPage.ts
import { createExecutionResultParser } from "@soda-gql/colocation-tools";
import { userCardFragment } from "./fragments/UserCard";
import { postListFragment } from "./fragments/PostList";

export const userPageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation({
    name: "UserPage",
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ $ }) => [
      //
      $colocate({
        userCard: userCardFragment.embed({ id: $.userId }),
        postList: postListFragment.embed({ userId: $.userId, limit: 10 }),
      }),
    ],
  }),
);

export const parseUserPageResult = createExecutionResultParser({
  userCard: userCardFragment,
  postList: postListFragment,
});
```

## Next Steps

- See [@soda-gql/colocation-tools](/api/packages/colocation-tools) for the complete API reference
- Explore [Recipes](/recipes/) for framework-specific colocation patterns
