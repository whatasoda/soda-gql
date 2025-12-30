# Variables

Variables allow you to parameterize fragments and operations. soda-gql uses a unique type syntax that provides full type safety while remaining concise.

## How soda-gql Variables Differ from GraphQL

Standard GraphQL uses this syntax for variables:

```graphql
query GetUser($id: ID!, $limit: Int) {
  user(id: $id) {
    posts(limit: $limit) { ... }
  }
}
```

soda-gql uses a TypeScript-based approach:

| Aspect | GraphQL | soda-gql |
|--------|---------|----------|
| **Syntax** | `$name: Type!` | `$var("name").Type("!")` |
| **Required** | `Type!` (suffix) | `"Type:!"` (suffix after colon) |
| **Optional** | `Type` (no suffix) | `"Type:?"` (explicit optional) |
| **Lists** | `[Type!]!` | `"Type:![]!"` |
| **Declaration** | In operation header | Object spread: `variables: { ...$var(...) }` |
| **Type Safety** | External codegen required | Compile-time inference |

:::info Explicit Nullability
Unlike GraphQL where omitting `!` means optional, soda-gql requires explicit `:!` or `:?` to make nullability clear and prevent mistakes.
:::

## Declaring Variables

Variables are declared using `$var()` with object spread syntax:

```typescript
gql.default(({ query }, { $var }) =>
  query.operation({
    name: "SearchPosts",
    variables: {
      ...$var("query").String("!"),      // Required string
      ...$var("limit").Int("?"),         // Optional int
      ...$var("tags").String("![]?"),    // Optional list of required strings
    },
    fields: ({ f, $ }) => ({ ... }),
  }),
);
```

## Type Specifier Syntax

The type specifier follows this pattern: `"TypeName:nullability[listNullability]..."`

### Basic Types

| Specifier | Meaning | GraphQL Equivalent |
|-----------|---------|-------------------|
| `"ID:!"` | Required ID | `ID!` |
| `"ID:?"` | Optional ID | `ID` |
| `"String:!"` | Required String | `String!` |
| `"String:?"` | Optional String | `String` |
| `"Int:!"` | Required Int | `Int!` |
| `"Float:?"` | Optional Float | `Float` |
| `"Boolean:!"` | Required Boolean | `Boolean!` |

### List Types

Lists add `[]` with their own nullability:

| Specifier | Meaning | GraphQL Equivalent |
|-----------|---------|-------------------|
| `"String:![]!"` | Required list of required strings | `[String!]!` |
| `"String:![]?"` | Optional list of required strings | `[String!]` |
| `"String:?[]!"` | Required list of optional strings | `[String]!` |
| `"String:?[]?"` | Optional list of optional strings | `[String]` |

### Nested Lists

For lists of lists, chain the brackets:

| Specifier | GraphQL Equivalent |
|-----------|-------------------|
| `"Int:![]![]!"` | `[[Int!]!]!` |
| `"String:?[]?[]?"` | `[[String]]` |

### Custom Types

Use your schema's input types and custom scalars:

```typescript
$var("input").CreateUserInput("!")    // Custom input type
$var("cursor").Cursor("?")            // Custom scalar
$var("filters").FilterInput("![]?")   // List of custom input
```

## Using Variables

### In Field Arguments

Reference declared variables using `$`:

```typescript
({ f, $ }) => ({
  ...f.user({ id: $.userId })(({ f }) => ({ ... })),
  ...f.posts({ limit: $.limit, tags: $.tags })(({ f }) => ({ ... })),
})
```

### Passing to Spread Fragments

Pass variables to spread fragments:

```typescript
// Fragment with its own variable
const userFragment = gql.default(({ fragment }, { $var }) =>
  fragment.Query({
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
      })),
    }),
  }),
);

// Operation passing its variable to the fragment
const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ $ }) => ({
      // Pass operation variable to fragment variable
      ...userFragment.spread({ userId: $.userId }),
    }),
  }),
);
```

## Built-in Scalar Types

soda-gql recognizes these standard GraphQL scalars:

| Type | TypeScript Type | Description |
|------|-----------------|-------------|
| `ID` | `string` | Unique identifier |
| `String` | `string` | UTF-8 string |
| `Int` | `number` | 32-bit signed integer |
| `Float` | `number` | Double-precision float |
| `Boolean` | `boolean` | true/false |

Custom scalars are defined in your project's inject file:

```typescript
// In your default.inject.ts
import { defineScalar } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),   // ISO string when sending
    output: type<Date>(),    // Date object when receiving
    directives: {},
  })),
} as const;
```

## Type Inference

Variable types are fully inferred:

```typescript
const query = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "Search",
    variables: {
      ...$var("query").String("!"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({ ... }),
  }),
);

// Inferred type
type Variables = typeof query.$infer.input;
// { query: string; limit?: number }
```

When calling the query, TypeScript enforces correct variable types:

```typescript
// Correct
graphqlClient({
  document: query.document,
  variables: { query: "hello", limit: 10 },
});

// Error: 'query' is required
graphqlClient({
  document: query.document,
  variables: { limit: 10 },
});

// Error: 'limit' must be number or undefined
graphqlClient({
  document: query.document,
  variables: { query: "hello", limit: "10" },
});
```

## Next Steps

- Learn about [Metadata](/guide/metadata) for operation-level configuration
- Explore [Fragment Colocation](/guide/colocation) for component-based patterns
- See [API Reference](/api/packages/core) for complete type documentation
