# @soda-gql/vite-plugin

Vite plugin for soda-gql. Transforms soda-gql DSL to runtime calls during development and build.

## Features

- **Zero-config setup** - Works out of the box with soda-gql config
- **HMR support** - Hot module replacement for GraphQL operations
- **Fast rebuilds** - Incremental artifact updates

## Installation

```bash
npm install @soda-gql/vite-plugin
# or
bun add @soda-gql/vite-plugin
```

## Usage

Add the plugin to your Vite config:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [sodaGqlPlugin()],
});
```

## Configuration

The plugin automatically loads configuration from `soda-gql.config.ts`.

### Plugin Options

```typescript
sodaGqlPlugin({
  // Use a specific config file
  configPath: "./custom-config.ts",

  // Filter which files to transform
  include: ["src/**/*.ts"],
  exclude: ["**/*.test.ts"],
});
```

## How It Works

1. **Build phase** - The plugin uses `@soda-gql/builder` to analyze source files and generate artifacts
2. **Transform phase** - Uses `@soda-gql/babel` to replace `gql.default()` calls with `gqlRuntime.getOperation()` calls
3. **Watch mode** - Automatically rebuilds artifacts when GraphQL files change

## Requirements

- Vite 5.x or 6.x
- Node.js >= 18

## Related Packages

- [@soda-gql/webpack-plugin](../webpack-plugin) - Webpack integration
- [@soda-gql/metro-plugin](../metro-plugin) - React Native/Expo integration
- [@soda-gql/babel](../babel) - Babel transformer and plugin

## License

MIT
