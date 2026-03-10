# Getting Started

This guide walks you through setting up soda-gql in your project.

## Installation

```bash
# Install core packages
bun add @soda-gql/core
bun add -D @soda-gql/tools @soda-gql/config

# Install peer dependencies
bun add neverthrow
```

:::tip
soda-gql supports queries, mutations, and subscriptions. Field directives (`@skip`, `@include`) are supported in callback builder syntax. See the [Tagged Template Syntax Guide](/guide/tagged-template-syntax) for a feature comparison.
:::

## Setup

### 1. Initialize Project

Run the init command to scaffold all necessary files:

```bash
bun run soda-gql init
```

This creates:
- `soda-gql.config.ts` - Configuration file
- `schema.graphql` - Sample GraphQL schema
- `graphql-system/default.inject.ts` - Scalars and adapter definitions
- `graphql-system/.gitignore` - Ignore generated files

### 2. Edit Your Schema

Replace the sample `schema.graphql` with your actual GraphQL schema:

```graphql
type Query {
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
  email: String!
}
```

### 3. Customize Scalars and Adapter (Optional)

Edit `graphql-system/default.inject.ts` to add custom scalars:

```typescript
import { defineAdapter, defineScalar } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  // Add custom scalars
  ...defineScalar<"DateTime", string, Date>("DateTime"),
} as const;

export const adapter = defineAdapter({
  helpers: {},
  metadata: {
    aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
  },
});
```

### 4. Generate GraphQL System

```bash
bun run soda-gql codegen schema
```

This generates the type-safe GraphQL system in the `graphql-system/` directory.

## Basic Usage

### Define a Fragment

Fragments specify reusable field selections using tagged template syntax:

```typescript
import { gql } from "@/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment("UserFragment", "User")`{
    id
    name
  }`(),
);
```

### Create an Operation

Operations can also use tagged template syntax, with fragment spreads via interpolation:

```typescript
// Tagged template with fragment spread
export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($userId: ID!) {
    user(id: $userId) {
      ...${userFragment}
    }
  }`(),
);
```

For advanced features like field aliases, directives, or `$colocate`, use the callback builder syntax:

```typescript
// Callback builder (for advanced features)
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...userFragment.spread(),
      })),
    }),
  }),
);
```

### Execute the Query

```typescript
import { getUserQuery } from "@/queries/user.query";
import { graphqlClient } from "./client";

const result = await graphqlClient({
  document: getUserQuery.document,
  variables: { userId: "42" },
});
```

## Build Plugin Setup

soda-gql requires a build plugin to transform your code. Choose the one that matches your setup:

| Plugin | Use Case |
|--------|----------|
| `@soda-gql/babel` | Babel-based builds (use `/plugin` export) |
| `@soda-gql/tsc` | TypeScript compiler (use `/plugin` export) |
| `@soda-gql/webpack-plugin` | Webpack projects |
| `@soda-gql/vite-plugin` | Vite projects |
| `@soda-gql/metro-plugin` | React Native / Expo |

See the [Recipes](/recipes/) section for framework-specific setup guides.

## Next Steps

- Learn about [Fragments](/guide/fragments) and [Operations](/guide/operations) in detail
- Understand the [Tagged Template Syntax](/guide/tagged-template-syntax) and when to use callback builders
- Explore [Variables](/guide/variables) for parameterized operations
- Check out [Recipes](/recipes/) for framework integration examples
- See the [API Reference](/api/) for detailed documentation
