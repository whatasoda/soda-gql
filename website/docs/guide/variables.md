# Variables

Variables allow you to parameterize fragments and operations. soda-gql uses standard GraphQL variable syntax in tagged templates and a template literal approach in the options-object path.

## How soda-gql Variables Differ from GraphQL

Standard GraphQL uses this syntax for variables:

```graphql
query GetUser($id: ID!, $limit: Int) {
  user(id: $id) {
    posts(limit: $limit) { ... }
  }
}
```

soda-gql provides two approaches depending on the syntax you use:

| Aspect | GraphQL | Tagged Template | Options-Object Path |
|--------|---------|----------|----------|
| **Syntax** | `$name: Type!` | `($name: Type!)` (standard GraphQL) | `` variables: `($name: Type!)` `` |
| **Required** | `Type!` | `Type!` | `Type!` |
| **Optional** | `Type` (no suffix) | `Type` (no suffix) | `Type` (no suffix) |
| **Lists** | `[Type!]!` | `[Type!]!` | `[Type!]!` |
| **Declaration** | In operation header | In template: `` `($id: ID!) { ... }` `` | `` variables: `($id: ID!)` `` |
| **Type Safety** | External codegen | Build-time validation | Build-time validation |

:::tip Tagged Templates Use Standard GraphQL Variable Syntax
When using tagged template syntax, variables are declared using standard GraphQL syntax directly in the template. The options-object path uses the same syntax in a `variables` template literal. See the [Tagged Template Syntax Guide](/guide/tagged-template-syntax) for details.
:::

## Declaring Variables in Tagged Templates

In tagged templates, declare variables using standard GraphQL syntax at the start of the template:

```typescript
export const searchPostsQuery = gql.default(({ query }) =>
  query("SearchPosts")`($query: String!, $limit: Int, $tags: [String!]) {
    searchPosts(query: $query, limit: $limit, tags: $tags) {
      id
      title
    }
  }`(),
);
```

This is the recommended approach for most operations. The variable syntax is identical to standard GraphQL.

## Declaring Variables in the Options-Object Path

When using the options-object path (for aliases, directives, `$dir`, `$colocate`, or programmatic field control), declare variables with a template literal:

```typescript
export const searchPostsQuery = gql.default(({ query }) =>
  query("SearchPosts")({
    variables: `($query: String!, $limit: Int, $tags: [String!])`,
    fields: ({ f, $ }) => ({
      ...f("searchPosts", { query: $.query, limit: $.limit, tags: $.tags })(({ f }) => ({
        ...f("id")(),
        ...f("title")(),
      })),
    }),
  })({}),
);
```

## Variable Type Syntax

Variables use standard GraphQL type notation:

### Basic Types

| Declaration | Meaning | GraphQL Equivalent |
|-------------|---------|-------------------|
| `$id: ID!` | Required ID | `ID!` |
| `$id: ID` | Optional ID | `ID` |
| `$name: String!` | Required String | `String!` |
| `$name: String` | Optional String | `String` |
| `$count: Int!` | Required Int | `Int!` |
| `$score: Float` | Optional Float | `Float` |
| `$active: Boolean!` | Required Boolean | `Boolean!` |

### List Types

| Declaration | Meaning | GraphQL Equivalent |
|-------------|---------|-------------------|
| `$tags: [String!]!` | Required list of required strings | `[String!]!` |
| `$tags: [String!]` | Optional list of required strings | `[String!]` |
| `$tags: [String]!` | Required list of optional strings | `[String]!` |
| `$tags: [String]` | Optional list of optional strings | `[String]` |

### Custom Types

Use your schema's input types and custom scalars:

```typescript
// In tagged template
query("CreateUser")`($input: CreateUserInput!, $cursor: Cursor, $filters: [FilterInput!]) {
  ...
}`()

// In options-object path
query("CreateUser")({
  variables: `($input: CreateUserInput!, $cursor: Cursor, $filters: [FilterInput!])`,
  fields: ({ f, $ }) => ({ ... }),
})({}),
```

## Using Variables in Field Arguments

Reference declared variables using `$` in the options-object path:

```typescript
({ f, $ }) => ({
  ...f("user", { id: $.userId })(({ f }) => ({ ... })),
  ...f("posts", { limit: $.limit, tags: $.tags })(({ f }) => ({ ... })),
})
```

In tagged templates, use standard GraphQL `$varName` syntax directly:

```typescript
query("GetUser")`($userId: ID!) {
  user(id: $userId) {
    id
    name
  }
}`()
```

## Variable References in Fragment Spreading

### Tagged Template (Interpolation)

Pass variables to fragments using callback interpolation:

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

Pass variables directly through the `.spread()` method:

```typescript
export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($userId: ID!, $includeEmail: Boolean)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.userId })(({ f }) => ({
        ...userFragment.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  })({}),
);
```

When a fragment has variables, you must pass values for them. These can be:
- Literal values: `{ includeEmail: true }`
- Operation variables: `{ includeEmail: $.includeEmail }`

## $var in Metadata Callbacks

The `$var` utility is available in metadata callbacks for inspecting variable references. Methods like `$var.getName()`, `$var.getValue()`, and `$var.getInner()` allow you to extract information from VarRef values. See the [Metadata](/guide/metadata) guide for details.

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
const query = gql.default(({ query }) =>
  query("Search")`($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      id
      title
    }
  }`(),
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
