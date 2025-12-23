# Recipes

Practical examples demonstrating different integration methods for soda-gql.

## Quick Comparison

| Feature | TSC Plugin | SWC Plugin | Webpack Plugin | Babel Plugin | Vite Plugin | Metro Plugin |
|---------|-----------|-----------|----------------|--------------|-------------|--------------|
| Build Speed | Fast | Very Fast | Standard | Fast | Fast | Fast |
| Zero-Runtime | Planned | Planned | Working | Working | Working | Working |
| Watch Mode | Manual | Manual | Integrated | Manual | Integrated | Integrated |
| Best For | TypeScript projects | Large codebases | Webpack builds | Custom setups | Vite projects | React Native |

## NestJS Integration

### TypeScript Compiler Plugin

**Best for:** Most projects, especially those preferring standard TypeScript tooling.

```bash
bun add -D @soda-gql/tsc-plugin
```

```json
// nest-cli.json
{
  "compilerOptions": {
    "builder": "tsc",
    "plugins": ["@soda-gql/tsc-plugin"]
  }
}
```

[View example on GitHub](https://github.com/whatasoda/soda-gql/tree/main/examples/nestjs-compiler-tsc)

### SWC Compiler Plugin

**Best for:** Large projects requiring fastest possible builds.

```bash
bun add -D @soda-gql/swc-transformer
```

[View example on GitHub](https://github.com/whatasoda/soda-gql/tree/main/examples/nestjs-compiler-swc)

### Webpack Plugin

**Best for:** Projects needing working zero-runtime transformation today.

```bash
bun add -D @soda-gql/webpack-plugin
```

```javascript
// webpack.config.js
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = {
  plugins: [new SodaGqlWebpackPlugin()],
};
```

[View example on GitHub](https://github.com/whatasoda/soda-gql/tree/main/examples/nestjs-app)

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

[View example on GitHub](https://github.com/whatasoda/soda-gql/tree/main/examples/expo-metro)

## Babel Integration

For framework-agnostic usage or custom build setups:

```bash
bun add -D @soda-gql/babel-plugin
```

```javascript
// babel.config.js
module.exports = {
  plugins: ["@soda-gql/babel-plugin"],
};
```

[View example on GitHub](https://github.com/whatasoda/soda-gql/tree/main/examples/babel-app)

## Common Setup Steps

All integrations follow similar setup steps:

```bash
# 1. Install dependencies
bun install

# 2. Generate GraphQL system
bun run soda-gql codegen

# 3. Build your project
bun run build
```

## Learning Path

New to soda-gql? Follow this path:

1. **Start with [NestJS + TSC](https://github.com/whatasoda/soda-gql/tree/main/examples/nestjs-compiler-tsc)** - Simplest setup, best for learning
2. **Explore [NestJS + Webpack](https://github.com/whatasoda/soda-gql/tree/main/examples/nestjs-app)** - See integrated workflow
3. **Try [NestJS + SWC](https://github.com/whatasoda/soda-gql/tree/main/examples/nestjs-compiler-swc)** - Experience build speed improvements
4. **Check [Babel](https://github.com/whatasoda/soda-gql/tree/main/examples/babel-app)** - Understand framework-agnostic usage

## More Examples

See the full list of examples in the [GitHub repository](https://github.com/whatasoda/soda-gql/tree/main/examples).
