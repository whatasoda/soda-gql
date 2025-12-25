# What is soda-gql?

soda-gql is a zero-runtime GraphQL query generation system that brings [PandaCSS](https://panda-css.com/)'s approach to GraphQL. Write type-safe queries in TypeScript that are statically analyzed and transformed at build time into optimized GraphQL documents.

## Why soda-gql?

Traditional GraphQL development involves a code generation loop:

1. Write GraphQL queries
2. Run codegen to generate TypeScript types
3. Import and use the generated types
4. Repeat for every change

This cycle creates friction: you write code in two languages, wait for generation, and deal with out-of-sync types.

**soda-gql eliminates this loop.** You write everything in TypeScript, and the build system handles the rest.

## Core Concepts

### Models

Models define reusable GraphQL fragments. They specify which fields to select from a type:

```typescript
import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User({}, ({ f }) => [f.id(), f.name(), f.email()]),
);
```

### Slices

Slices are domain-specific query or mutation pieces. They define variables, field selections, and result projections:

```typescript
export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    { variables: [$var("userId").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.userId })(() => [userModel.embed()])],
    ({ select }) =>
      select(["$.user"], (result) => result.safeUnwrap(([user]) => user)),
  ),
);
```

### Operations

Operations compose slices into complete GraphQL queries or mutations:

```typescript
export const profileQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      name: "ProfileQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ userId: $.userId }),
    }),
  ),
);
```

## Project Structure

```
packages/
├── core/           # Core GraphQL types and utilities
├── codegen/        # Schema code generation
├── builder/        # Static analysis & artifact generation
├── babel-plugin/   # Babel transformation plugin
├── tsc-plugin/     # TypeScript compiler plugin
├── webpack-plugin/ # Webpack plugin with HMR support
├── vite-plugin/    # Vite bundler plugin
├── metro-plugin/   # React Native/Expo Metro plugin
├── runtime/        # Runtime execution helpers
└── cli/            # Command-line interface
```

## Next Steps

Ready to get started? Head to the [Getting Started](/guide/getting-started) guide.
