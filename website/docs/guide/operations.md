# Operations

Operations are complete GraphQL queries, mutations, or subscriptions. They define variables, select fields, and produce executable GraphQL documents.

## How soda-gql Operations Differ from GraphQL

In standard GraphQL, operations are written as query strings:

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
  }
}
```

soda-gql operations are TypeScript functions:

| Aspect | GraphQL | soda-gql |
|--------|---------|----------|
| **Definition** | String-based query language | TypeScript builder functions |
| **Variables** | `$name: Type!` syntax | `$var("name").Type("!")` with full type safety |
| **Variable Declaration** | Object-style in query header | Object spread: `{ ...$var(...), ...$var(...) }` |
| **Field Selections** | Implicit object syntax | Object spread: `({ ...f.id(), ...f.name() })` |
| **Type Checking** | Requires external codegen step | Compile-time validation |
| **Output** | Runtime parsing needed | `.document` for query |

:::info Object Spread API
soda-gql uses object spread syntax for both variable declarations and field selections. This design enables better type inference and explicit field merging.
:::

## Operation Types

soda-gql supports three operation types:

```typescript
// Query - fetch data
gql.default(({ query , $var }) =>
  query.operation({ name: "GetUser", variables: { ... }, fields: ({ f, $ }) => ({ ... }) })
);

// Mutation - modify data
gql.default(({ mutation , $var }) =>
  mutation.operation({ name: "CreateUser", variables: { ... }, fields: ({ f, $ }) => ({ ... }) })
);

// Subscription - real-time updates (planned)
gql.default(({ subscription , $var }) =>
  subscription.operation({ name: "UserUpdated", variables: { ... }, fields: ({ f, $ }) => ({ ... }) })
);
```

## Defining an Operation

A complete operation definition includes:

```typescript
import { gql } from "@/graphql-system";

export const getUserQuery = gql.default(({ query , $var }) =>
  query.operation({
    name: "GetUser",                                  // Operation name
    variables: { ...$var("userId").ID("!") },         // Variable declarations
    fields: ({ f, $ }) => ({
      // Field selections
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
      })),
    }),
  }),
);
```

### Operation Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Required. The GraphQL operation name |
| `variables` | `{ ...$var(...) }` | Object spread of variable declarations |
| `metadata` | `function` | Optional. Runtime metadata (see [Metadata](/guide/metadata)) |
| `fields` | `function` | Required. Field selection builder function |

## Field Selections

Field selections in operations work the same as in fragments:

```typescript
({ f, $ }) => ({
  // Scalar fields
  ...f.id(),
  ...f.createdAt(),

  // Fields with arguments
  ...f.posts({ limit: 10 })(({ f }) => ({
    ...f.id(),
    ...f.title(),
  })),

  // Nested selections
  ...f.user({ id: $.userId })(({ f }) => ({
    ...f.id(),
    ...f.profile()(({ f }) => ({
      ...f.avatarUrl(),
      ...f.bio(),
    })),
  })),
})
```

## Spreading Fragments

Spread fragments to reuse field selections:

```typescript
import { userFragment } from "./user.fragment";

export const getUserQuery = gql.default(({ query , $var }) =>
  query.operation({
    name: "GetUser",
    variables: {
      ...$var("userId").ID("!"),
      ...$var("includeEmail").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        // Spread fragment with variable passing
        ...userFragment.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  }),
);
```

When a fragment has variables, you must pass values for them. These can be:
- Literal values: `{ includeEmail: true }`
- Operation variables: `{ includeEmail: $.includeEmail }`

## Operation Output

Every operation provides two key properties:

### .document

The compiled GraphQL document string, ready to send to a GraphQL server:

```typescript
console.log(getUserQuery.document);
// query GetUser($userId: ID!) {
//   user(id: $userId) {
//     id
//     name
//     email
//   }
// }
```

## Type Inference

Extract TypeScript types from operations:

```typescript
// Input type (variables required for this operation)
type GetUserVariables = typeof getUserQuery.$infer.input;
// { userId: string }

// Output type (parsed response structure)
type GetUserResult = typeof getUserQuery.$infer.output.projected;
// { user: { id: string; name: string; email: string } }
```

## Mutations

Mutations follow the same pattern as queries:

```typescript
export const createUserMutation = gql.default(({ mutation , $var }) =>
  mutation.operation({
    name: "CreateUser",
    variables: { ...$var("input").CreateUserInput("!") },
    fields: ({ f, $ }) => ({
      ...f.createUser({ input: $.input })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);

// Usage
const result = await graphqlClient({
  document: createUserMutation.document,
  variables: {
    input: { name: "Alice", email: "alice@example.com" },
  },
});
```

## Next Steps

- Understand [Variables](/guide/variables) syntax in detail
- Learn about [Metadata](/guide/metadata) for operation-level configuration
- Explore [Fragment Colocation](/guide/colocation) for component-based patterns
