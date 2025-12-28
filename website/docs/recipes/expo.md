# Expo / React Native Setup

This guide shows how to set up soda-gql with Expo or React Native projects using the Metro plugin.

## Prerequisites

- Expo SDK 49+ or React Native 0.72+
- Node.js 18+

## Installation

```bash
# Install soda-gql packages
bun add @soda-gql/core
bun add -D @soda-gql/cli @soda-gql/config @soda-gql/metro-plugin
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

### 2. Configure Metro

#### Expo Projects

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);

module.exports = withSodaGql(config);
```

#### React Native (Bare) Projects

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = mergeConfig(getDefaultConfig(__dirname), {
  // Your custom config
});

module.exports = withSodaGql(config);
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
my-expo-app/
├── src/
│   ├── App.tsx
│   ├── graphql-system/         # Generated
│   │   ├── index.ts
│   │   └── default.inject.ts
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   └── UserScreen.tsx
│   └── queries/
│       └── user.query.ts
├── schema.graphql
├── soda-gql.config.ts
├── metro.config.js
└── app.json
```

## Usage Examples

### Define a Query

```typescript
// src/queries/user.query.ts
import { gql } from "@/graphql-system";

export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [
        //
        $var("id").scalar("ID:!"),
      ],
    },
    ({ f, $ }) => [
      //
      f.user({ id: $.id })(({ f }) => [
        //
        f.id(),
        f.name(),
        f.email(),
        f.avatarUrl(),
      ]),
    ],
  ),
);
```

### Screen Component

```typescript
// src/screens/UserScreen.tsx
import { useState, useEffect } from "react";
import { View, Text, Image, ActivityIndicator, StyleSheet } from "react-native";
import { getUserQuery } from "@/queries/user.query";

type User = NonNullable<typeof getUserQuery.$infer.output.projected["user"]>;

export function UserScreen({ route }: { route: { params: { id: string } } }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(process.env.EXPO_PUBLIC_GRAPHQL_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: getUserQuery.document,
            variables: { id: route.params.id },
          }),
        });

        const json = await response.json();
        const data = getUserQuery.parse(json);
        setUser(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [route.params.id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  name: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  email: { fontSize: 16, color: "#666" },
  error: { color: "red", fontSize: 16 },
});
```

### Using with React Query / TanStack Query

```typescript
// src/hooks/useUser.ts
import { useQuery } from "@tanstack/react-query";
import { getUserQuery } from "@/queries/user.query";

async function fetchUser(id: string) {
  const response = await fetch(process.env.EXPO_PUBLIC_GRAPHQL_URL!, {
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

export function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id),
  });
}
```

## TypeScript Configuration

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

Configure Babel for path aliases:

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./src",
          },
        },
      ],
    ],
  };
};
```

## Development

Start the development server:

```bash
# Expo
npx expo start

# React Native CLI
npx react-native start
```

### Clear Cache

If you experience stale transformations, clear the cache:

```bash
# Expo
npx expo start --clear

# React Native CLI
npx react-native start --reset-cache
```

## Troubleshooting

### Metro "Unable to resolve module"

1. Ensure path aliases are configured in both `tsconfig.json` and `babel.config.js`
2. Clear Metro cache: `npx expo start --clear`
3. Verify the import paths in your soda-gql config

### Slow Initial Build

The first build analyzes all files. To improve:

1. Use specific `include` patterns in `soda-gql.config.ts`
2. Add `exclude` patterns for test files
3. Subsequent builds use caching

### TypeScript Errors After Codegen

After running `soda-gql codegen`:

1. Restart TypeScript server in your editor
2. For VS Code: `Cmd+Shift+P` > "TypeScript: Restart TS Server"

## Related

- [Metro Plugin API](/api/packages/metro-plugin)
- [Configuration](/api/packages/config)
- [Fragment Colocation](/guide/colocation)
