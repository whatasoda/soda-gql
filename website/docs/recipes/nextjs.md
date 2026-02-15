# Next.js Integration

This guide shows how to set up soda-gql with Next.js using the Webpack plugin.

## Prerequisites

- Next.js 13+ (App Router or Pages Router)
- Node.js 18+

## Installation

```bash
bun add @soda-gql/core
bun add -D @soda-gql/cli @soda-gql/config @soda-gql/webpack-plugin
```

## Configuration

### 1. Create soda-gql Config

```typescript
// soda-gql.config.ts
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts", "./src/**/*.tsx"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./src/graphql-system/default.inject.ts",
    },
  },
});
```

### 2. Configure Next.js

```javascript
// next.config.js
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add the soda-gql webpack plugin
    config.plugins.push(new SodaGqlWebpackPlugin());

    // Add the loader for TypeScript files
    config.module.rules.push({
      test: /\.[jt]sx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: "@soda-gql/webpack-plugin/loader",
        },
      ],
    });

    return config;
  },
};

module.exports = nextConfig;
```

### 3. Initialize Project

```bash
# Initialize with templates
bun run soda-gql init

# Generate the GraphQL system
bun run soda-gql codegen schema
```

## Project Structure

```
my-next-app/
├── src/
│   ├── app/                    # App Router
│   │   ├── page.tsx
│   │   └── users/
│   │       └── page.tsx
│   ├── graphql-system/         # Generated
│   │   ├── index.ts
│   │   └── default.inject.ts
│   ├── fragments/              # Your fragments
│   │   └── user.fragment.ts
│   └── queries/                # Your queries
│       └── user.query.ts
├── schema.graphql
├── soda-gql.config.ts
└── next.config.js
```

## Usage Examples

### Define a Fragment

```typescript
// src/fragments/user.fragment.ts
import { gql } from "@/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment on User {
    id
    name
    email
    avatarUrl
  }`(),
);
```

### Define a Query

```typescript
// src/queries/user.query.ts
import { gql } from "@/graphql-system";
import { userFragment } from "@/fragments/user.fragment";

export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...userFragment.spread(),
      })),
    }),
  }),
);
```

### Server Component

```typescript
// src/app/users/[id]/page.tsx
import { getUserQuery } from "@/queries/user.query";

async function fetchUser(id: string) {
  const response = await fetch(process.env.GRAPHQL_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: getUserQuery.document,
      variables: { id },
    }),
  });

  const json = await response.json();
  return getUserQuery.parse(json);
}

export default async function UserPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchUser(params.id);

  return (
    <div>
      <h1>{data.user?.name}</h1>
      <p>{data.user?.email}</p>
    </div>
  );
}
```

### Client Component

```typescript
// src/components/UserProfile.tsx
"use client";

import { useState, useEffect } from "react";
import { getUserQuery } from "@/queries/user.query";

type User = typeof getUserQuery.$infer.output.projected["user"];

export function UserProfile({ id }: { id: string }) {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: getUserQuery.document,
        variables: { id },
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        const data = getUserQuery.parse(json);
        setUser(data.user);
      });
  }, [id]);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes path aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Tips

### Development

- The webpack plugin supports HMR for fast development
- Changes to fragments and operations trigger automatic rebuilds

### Production

- soda-gql transformations happen at build time
- No runtime overhead in production bundles
- Operations are tree-shakable

### With App Router

- Use Server Components for initial data fetching
- Client Components for interactive features
- Type safety works across both

## Related

- [Webpack Plugin API](/api/packages/webpack-plugin)
- [Configuration](/api/packages/config)
