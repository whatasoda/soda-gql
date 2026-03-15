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

soda-gql operations are TypeScript functions with two syntax options:

| Aspect | GraphQL | soda-gql (Tagged Template) | soda-gql (Options-Object Path) |
|--------|---------|----------|----------|
| **Definition** | String-based | Template literals with GraphQL syntax | TypeScript builder functions |
| **Variables** | `$name: Type!` | `($name: Type!)` in template | `variables: \`($name: Type!)\`` |
| **Field Selections** | Implicit | GraphQL syntax in template | Object spread: `({ ...f("id")() })` |
| **Type Checking** | Requires codegen | Build-time validation | Build-time validation |
| **Best for** | — | Simple queries/mutations | Aliases, directives, `$colocate` |

:::tip Recommended Syntax
Use **tagged templates** for most operations. Switch to the **options-object path** when you need field aliases, directives (`@skip`, `@include`), or `$colocate` for fragment colocation. See the [Tagged Template Syntax Guide](/guide/tagged-template-syntax) for details.
:::

## Operation Types

soda-gql supports three operation types:

```typescript
// Query - fetch data
gql.default(({ query }) =>
  query("GetUser")`($userId: ID!) {
    user(id: $userId) { id name }
  }`()
);

// Mutation - modify data
gql.default(({ mutation }) =>
  mutation("CreateUser")`($input: CreateUserInput!) {
    createUser(input: $input) { id name }
  }`()
);

// Subscription - real-time updates
gql.default(({ subscription }) =>
  subscription("UserUpdated")`($userId: ID!) {
    userUpdated(userId: $userId) { id name }
  }`()
);
```

## Defining an Operation

### Tagged Template Syntax (Recommended)

The simplest way to define an operation uses tagged template syntax — write GraphQL directly as a template literal:

```typescript
import { gql } from "@/graphql-system";

export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($userId: ID!) {
    user(id: $userId) {
      id
      name
      email
    }
  }`(),
);
```

This is concise, readable, and familiar to developers who know GraphQL syntax. The trailing `()` finalizes the operation.

### Options-Object Path

For advanced features like field aliases, directives, or `$colocate`, use the options-object path:

```typescript
import { gql } from "@/graphql-system";

export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($userId: ID!)`,                      // Variable declarations
    fields: ({ f, $ }) => ({
      // Field selections
      ...f("user", { id: $.userId })(({ f }) => ({
        ...f("id")(),
        ...f("name")(),
        ...f("email")(),
      })),
    }),
  })({}),
);
```

### Operation Options

| Option | Type | Description |
|--------|------|-------------|
| `variables` | `` `($name: Type!)` `` | Template literal with GraphQL variable syntax |
| `metadata` | `function` | Optional. Runtime metadata (see [Metadata](/guide/metadata)) |
| `fields` | `function` | Required. Field selection builder function |

## Field Selections

Field selections in operations work the same as in fragments:

```typescript
({ f, $ }) => ({
  // Scalar fields
  ...f("id")(),
  ...f("createdAt")(),

  // Fields with arguments
  ...f("posts", { limit: 10 })(({ f }) => ({
    ...f("id")(),
    ...f("title")(),
  })),

  // Nested selections
  ...f("user", { id: $.userId })(({ f }) => ({
    ...f("id")(),
    ...f("profile")(({ f }) => ({
      ...f("avatarUrl")(),
      ...f("bio")(),
    })),
  })),
})
```

## Spreading Fragments

### Tagged Template (Interpolation)

In tagged templates, use `${...}` interpolation to spread fragments:

```typescript
import { userFragment } from "./user.fragment";

export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($userId: ID!) {
    user(id: $userId) {
      ...${userFragment}
    }
  }`(),
);
```

For fragments with variables, use a callback function to pass variable bindings:

```typescript
export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($userId: ID!, $includeEmail: Boolean) {
    user(id: $userId) {
      ...${({ $ }) => userFragment.spread({ includeEmail: $.includeEmail })}
    }
  }`(),
);
```

### Options-Object Path (.spread())

In the options-object path, use `.spread()`:

```typescript
import { userFragment } from "./user.fragment";

export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($userId: ID!, $includeEmail: Boolean)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.userId })(({ f }) => ({
        // Spread fragment with variable passing
        ...userFragment.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  })({}),
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
export const createUserMutation = gql.default(({ mutation }) =>
  mutation("CreateUser")`($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
    }
  }`(),
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
