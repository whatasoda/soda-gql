# What is soda-gql?

soda-gql is a zero-runtime-like GraphQL query generation system that brings [PandaCSS](https://panda-css.com/)'s approach to GraphQL. Write type-safe queries in TypeScript that are statically analyzed and transformed at build time into optimized GraphQL documents.

## Why soda-gql?

Traditional GraphQL development involves a code generation loop:

1. Write GraphQL queries
2. Run codegen to generate TypeScript types
3. Import and use the generated types
4. Repeat for every change

This cycle creates friction: you write code in two languages, wait for generation, and deal with out-of-sync types.

**soda-gql eliminates this loop.** You write everything in TypeScript, and the build system handles the rest.

## What "Zero-Runtime-Like" Means

Inspired by [PandaCSS](https://panda-css.com/), soda-gql analyzes your code at build time and embeds pre-computed data as JSON. However, unlike CSS which is truly zero-runtime, soda-gql still requires runtime processing for:

- Query execution against GraphQL servers
- Response parsing and type coercion
- Variable interpolation

What happens at **build time**:
- GraphQL document string generation
- Metadata computation
- Type validation

This approach eliminates the codegen loop while keeping runtime overhead minimal.

## Core Concepts

### Fragments

Fragments define reusable field selections for GraphQL types:

```typescript
import { gql } from "@/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => [
      //
      f.id(),
      f.name(),
      f.email(),
    ],
  }),
);
```

### Operations

Operations define complete GraphQL queries, mutations, or subscriptions with field selections:

```typescript
export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "ProfileQuery",
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ f, $ }) => [
      //
      f.user({ id: $.userId })(({ f }) => [
        //
        userFragment.embed(),
      ]),
    ],
  }),
);
```

## Next Steps

Ready to get started? Head to the [Getting Started](/guide/getting-started) guide.
