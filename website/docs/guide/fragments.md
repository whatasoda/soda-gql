# Fragments

Fragments are reusable, type-safe field selections for GraphQL types. They define how to select and structure fields from your schema.

## How soda-gql Fragments Differ from GraphQL

In standard GraphQL, fragments are defined as strings within your query documents:

```graphql
fragment UserFields on User {
  id
  name
  email
}
```

soda-gql takes a different approach:

| Aspect | GraphQL | soda-gql |
|--------|---------|----------|
| **Definition** | String-based, inside `.graphql` files | TypeScript functions with full IDE support |
| **Type Safety** | Requires external codegen | Built-in type inference |
| **Variables** | Not supported in standard GraphQL fragments | First-class support with `$var` |
| **Composition** | `...FragmentName` spread syntax | `.spread()` method with typed variable passing |
| **IDE Support** | Limited (depends on tooling) | Full autocomplete, go-to-definition, refactoring |

:::tip
soda-gql fragments with variables are similar to Relay's `@argumentDefinitions` directive, but work without any GraphQL server extensions.
:::

## Defining a Fragment

Use the `gql.default()` pattern to define a fragment:

```typescript
import { gql } from "@/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email(),
    }),
  }),
);
```

The `fragment.User` call specifies the GraphQL type this fragment applies to. The field builder (`f`) provides type-safe access to all fields defined on that type.

## Field Selection API

### Basic Fields

Select scalar fields directly:

```typescript
...f.id()      // Select the id field
...f.name()    // Select the name field
```

### Fields with Arguments

Pass arguments as an object:

```typescript
f.posts({ limit: 10, offset: 0 })
f.avatar({ size: "LARGE" })
```

### Nested Selections

For fields that return object types, use curried syntax to select nested fields:

```typescript
...f.posts({ limit: 10 })(({ f }) => ({
  ...f.id(),
  ...f.title(),
  ...f.author()(({ f }) => ({
    ...f.id(),
    ...f.name(),
  })),
}))
```

### Field Aliases

Rename fields in the response using the alias option:

```typescript
...f.id(null, { alias: "userId" })
...f.name(null, { alias: "displayName" })
```

## Fragment Variables

Unlike standard GraphQL fragments, soda-gql fragments can declare their own variables:

```typescript
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
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
```

Variables are declared using object spread syntax with `$var()`. The variable reference (`$`) provides typed access to these variables within field arguments.

## Spreading Fragments

Spread fragments in other fragments or operations using `.spread()`:

```typescript
export const postFragment = gql.default(({ fragment }) =>
  fragment.Post({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.title(),
      ...f.author()(({ f }) => ({
        ...userFragment.spread({ includeEmail: false }),
      })),
    }),
  }),
);
```

When spreading a fragment with variables, pass the values through the first argument:

```typescript
// Parent operation with its own variable
export const getPostQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetPost",
    variables: {
      ...$var("postId").ID("!"),
      ...$var("showEmail").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.post({ id: $.postId })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.author()(({ f }) => ({
          // Pass parent variable to spread fragment
          ...userFragment.spread({ includeEmail: $.showEmail }),
        })),
      })),
    }),
  }),
);
```

## Type Inference

Extract TypeScript types from fragments using `$infer`:

```typescript
// Input type (variables required to use this fragment)
type UserInput = typeof userFragment.$infer.input;
// { includeEmail?: boolean }

// Output type (shape of selected fields)
type UserOutput = typeof userFragment.$infer.output;
// { id: string; name: string; email?: string }
```

This is useful for typing function parameters or component props:

```typescript
function UserCard({ user }: { user: typeof userFragment.$infer.output }) {
  return <div>{user.name}</div>;
}
```

## Extending Fragments with attach()

The `attach()` method allows adding custom properties to fragments. This is useful for colocating related functionality:

```typescript
import type { GqlElementAttachment } from "@soda-gql/core";

export const userFragment = gql
  .default(({ fragment }) =>
    fragment.User({
      fields: ({ f }) => ({
        ...f.id(),
        ...f.name(),
      }),
    }),
  )
  .attach({
    name: "displayName",
    createValue: (element) => (user: typeof element.$infer.output) =>
      user.name.toUpperCase(),
  });

// Use the attached function
const formatted = userFragment.displayName(userData);
```

For colocation patterns, see the [Fragment Colocation](/guide/colocation) guide.

## Next Steps

- Learn about [Operations](/guide/operations) to create complete GraphQL queries
- Understand [Variables](/guide/variables) syntax in detail
- Explore [Fragment Colocation](/guide/colocation) for component-based patterns
