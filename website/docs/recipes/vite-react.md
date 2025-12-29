# Vite + React Setup

This guide shows how to set up soda-gql with Vite and React.

## Prerequisites

- Node.js 18+
- Vite 5.x or 6.x

## Installation

```bash
# Create a new Vite project (if needed)
bun create vite my-app --template react-ts
cd my-app

# Install soda-gql packages
bun add @soda-gql/core
bun add -D @soda-gql/cli @soda-gql/config @soda-gql/vite-plugin
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

### 2. Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    sodaGqlPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 3. Initialize Project

```bash
# Initialize with templates
bun run soda-gql init

# Generate the GraphQL system
bun run soda-gql codegen
```

## Project Structure

```
my-vite-app/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── graphql-system/         # Generated
│   │   ├── index.ts
│   │   └── default.inject.ts
│   ├── components/
│   │   ├── UserCard.tsx
│   │   └── PostList.tsx
│   └── queries/
│       └── user.query.ts
├── schema.graphql
├── soda-gql.config.ts
└── vite.config.ts
```

## Usage Examples

### Basic Query

```typescript
// src/queries/user.query.ts
import { gql } from "@/graphql-system";

export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").scalar("ID:!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
      })),
    }),
  }),
);
```

### React Component

```typescript
// src/components/UserProfile.tsx
import { useState, useEffect } from "react";
import { getUserQuery } from "@/queries/user.query";

type QueryResult = typeof getUserQuery.$infer.output.projected;

export function UserProfile({ id }: { id: string }) {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: getUserQuery.document,
        variables: { id },
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        setData(getUserQuery.parse(json));
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data?.user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </div>
  );
}
```

## Fragment Colocation Pattern

For larger applications, colocate fragments with components:

### Component with Fragment

```typescript
// src/components/UserCard.tsx
import { gql } from "@/graphql-system";
import { createProjectionAttachment } from "@soda-gql/colocation-tools";

export const userCardFragment = gql
  .default(({ fragment }, { $var }) =>
    fragment.Query({
      variables: { ...$var("userId").scalar("ID:!") },
      fields: ({ f, $ }) => ({
        ...f.user({ id: $.userId })(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.avatarUrl(),
        })),
      }),
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.user"],
      handle: (result) => result.safeUnwrap((d) => d.user),
    }),
  );

type UserCardData = ReturnType<typeof userCardFragment.projection.projector>;

export function UserCard({ data }: { data: UserCardData }) {
  if (data.error) return <div>Error loading user</div>;
  if (!data.data) return <div>Loading...</div>;

  const user = data.data;
  return (
    <div className="user-card">
      <img src={user.avatarUrl} alt={user.name} />
      <h3>{user.name}</h3>
    </div>
  );
}
```

### Page Composing Fragments

```typescript
// src/pages/UserPage.tsx
import { gql } from "@/graphql-system";
import { createExecutionResultParser } from "@soda-gql/colocation-tools";
import { userCardFragment, UserCard } from "@/components/UserCard";
import { postListFragment, PostList } from "@/components/PostList";

const userPageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation({
    name: "UserPage",
    variables: { ...$var("userId").scalar("ID:!") },
    fields: ({ $ }) => ({
      ...$colocate({
        userCard: userCardFragment.embed({ userId: $.userId }),
        postList: postListFragment.embed({ userId: $.userId }),
      }),
    }),
  }),
);

const parseResult = createExecutionResultParser({
  userCard: userCardFragment,
  postList: postListFragment,
});

export function UserPage({ userId }: { userId: string }) {
  const [result, setResult] = useState<ReturnType<typeof parseResult> | null>(null);

  useEffect(() => {
    fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: userPageQuery.document,
        variables: { userId },
      }),
    })
      .then((res) => res.json())
      .then((json) => setResult(parseResult(json)));
  }, [userId]);

  if (!result) return <div>Loading...</div>;

  return (
    <div className="user-page">
      <UserCard data={result.userCard} />
      <PostList data={result.postList} />
    </div>
  );
}
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

## Development

Start the development server:

```bash
bun run dev
```

The Vite plugin provides:
- **HMR**: Changes to fragments and operations trigger instant updates
- **Fast Rebuilds**: Only modified files are re-transformed
- **Type Safety**: Full TypeScript inference during development

## Related

- [Vite Plugin API](/api/packages/vite-plugin)
- [Fragment Colocation](/guide/colocation)
- [Configuration](/api/packages/config)
