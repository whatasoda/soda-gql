# Recipes

Practical examples demonstrating different integration methods for soda-gql.

## Quick Comparison

| Feature | TSC Plugin | SWC Plugin | Webpack Plugin | Babel Plugin | Vite Plugin | Metro Plugin |
|---------|-----------|-----------|----------------|--------------|-------------|--------------|
| Build Speed | Fast | Very Fast | Standard | Fast | Fast | Fast |
| Zero-Runtime-Like | Planned | Planned | Working | Working | Working | Working |
| Watch Mode | Manual | Manual | Integrated | Manual | Integrated | Integrated |
| Best For | TypeScript projects | Large codebases | Webpack builds | Custom setups | Vite projects | React Native |

## NestJS Integration

### TypeScript Compiler Plugin

**Best for:** Most projects, especially those preferring standard TypeScript tooling.

```bash
bun add -D @soda-gql/tsc
```

```json
// nest-cli.json
{
  "compilerOptions": {
    "builder": "tsc",
    "plugins": ["@soda-gql/tsc/plugin"]
  }
}
```

[View playground on GitHub](https://github.com/whatasoda/soda-gql/tree/main/playgrounds/nestjs-compiler-tsc)

### Webpack Plugin with SWC

**Best for:** Projects needing working zero-runtime-like transformation today with fast builds.

```bash
bun add -D @soda-gql/webpack-plugin @soda-gql/swc
```

```javascript
// webpack.config.js
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = {
  plugins: [new SodaGqlWebpackPlugin({ transformer: "swc" })],
};
```

[View playground on GitHub](https://github.com/whatasoda/soda-gql/tree/main/playgrounds/nextjs-webpack)

## Vite Integration

For Vite-based projects:

```bash
bun add -D @soda-gql/vite-plugin
```

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [sodaGqlPlugin()],
});
```

## React Native / Expo Integration

For React Native projects using Metro bundler:

```bash
bun add -D @soda-gql/metro-plugin
```

[View playground on GitHub](https://github.com/whatasoda/soda-gql/tree/main/playgrounds/expo-metro)

## Common Setup Steps

All integrations follow similar setup steps:

```bash
# 1. Install dependencies
bun install

# 2. Generate GraphQL system
bun run soda-gql codegen schema

# 3. Build your project
bun run build
```

## Learning Path

New to soda-gql? Follow this path:

1. **Start with [Next.js + Webpack](https://github.com/whatasoda/soda-gql/tree/main/playgrounds/nextjs-webpack)** - Full-featured setup with SWC
2. **Explore [Vite + React](https://github.com/whatasoda/soda-gql/tree/main/playgrounds/vite-react)** - Fragment colocation pattern
3. **Try [Expo + Metro](https://github.com/whatasoda/soda-gql/tree/main/playgrounds/expo-metro)** - Mobile development

## More Playgrounds

See the full list of playgrounds in the [GitHub repository](https://github.com/whatasoda/soda-gql/tree/main/playgrounds).
