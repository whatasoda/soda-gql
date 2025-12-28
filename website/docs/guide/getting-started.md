# Getting Started

This guide walks you through setting up soda-gql in your project.

## Installation

```bash
# Install core packages
bun add @soda-gql/core @soda-gql/runtime
bun add -D @soda-gql/cli @soda-gql/config

# Install peer dependencies
bun add zod neverthrow
```

:::tip
This initial version supports queries and mutations only. Subscriptions, directives, and native GraphQL fragments are planned for future releases.
:::

## Setup

### 1. Configure Your Schema

Create a `soda-gql.config.ts` file in your project root:

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./src/graphql-system/runtime-adapter.ts",
      scalars: "./src/graphql-system/scalars.ts",
    },
  },
});
```

### 2. Prepare Scalars and Adapter

Scaffold the template files:

```bash
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/inject.ts
```

Edit the generated file to define your custom scalars and runtime adapter:

```typescript
import { defineScalar } from "@soda-gql/core";
import { createRuntimeAdapter } from "@soda-gql/runtime";

export const scalar = {
  ...defineScalar("DateTime", ({ type }) => ({
    input: type<string>(),
    output: type<Date>(),
    directives: {},
  })),
} as const;

export const adapter = createRuntimeAdapter(({ type }) => ({
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
}));
```

### 3. Generate GraphQL System

```bash
bun run soda-gql codegen
```

This generates the type-safe GraphQL system that imports your scalar and adapter definitions.

## Basic Usage

### Define a Fragment

Fragments specify reusable field selections:

```typescript
import { gql } from "@/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User({}, ({ f }) => [f.id(), f.name()]),
);
```

### Create an Operation

Operations define complete GraphQL queries with field selections:

```typescript
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(({ f }) => [userFragment.embed()]),
    ],
  ),
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

const data = getUserQuery.parse(result);
```

## Build Plugin Setup

soda-gql requires a build plugin to transform your code. Choose the one that matches your setup:

| Plugin | Use Case |
|--------|----------|
| `@soda-gql/babel-plugin` | Babel-based builds |
| `@soda-gql/tsc-plugin` | TypeScript compiler |
| `@soda-gql/webpack-plugin` | Webpack projects |
| `@soda-gql/vite-plugin` | Vite projects |
| `@soda-gql/metro-plugin` | React Native / Expo |

See the [Recipes](/recipes/) section for framework-specific setup guides.

## Next Steps

- Explore the [API Reference](/api/) for detailed documentation
- Check out [Recipes](/recipes/) for framework integration examples
