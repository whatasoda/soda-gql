# Build Plugin Setup Guide

Detailed setup instructions for each soda-gql build plugin.

## Plugin Overview

| Framework | Plugin | Package | Zero-Config |
|-----------|--------|---------|-------------|
| Next.js | webpack-plugin | `@soda-gql/webpack-plugin` | No |
| Vite/Remix/Astro | vite-plugin | `@soda-gql/vite-plugin` | Yes |
| Expo/React Native | metro-plugin | `@soda-gql/metro-plugin` | Yes |
| NestJS | tsc-plugin | `@soda-gql/tsc-plugin` | No |
| Custom Babel | babel-plugin | `@soda-gql/babel-plugin` | No |

## Next.js (webpack-plugin)

### Installation

```bash
bun add -D @soda-gql/webpack-plugin
```

### Configuration

```javascript
// next.config.js
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

/** @type {import('next').NextConfig} */
module.exports = {
  webpack: (config, { dev, isServer }) => {
    // Add plugin
    config.plugins.push(
      new SodaGqlWebpackPlugin({
        configPath: "./soda-gql.config.ts",
        debug: dev,
      })
    );

    // Add loader for TypeScript files
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: "@soda-gql/webpack-plugin/loader",
          options: {
            configPath: "./soda-gql.config.ts",
          },
        },
      ],
    });

    return config;
  },
};
```

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | `"./soda-gql.config.ts"` | Path to config file |
| `debug` | `boolean` | `false` | Enable debug logging |

### App Router Considerations

Works with both App Router and Pages Router. No special configuration needed.

## Vite (vite-plugin)

### Installation

```bash
bun add -D @soda-gql/vite-plugin
```

### Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sodaGqlPlugin(), // Zero-config: auto-detects soda-gql.config.ts
  ],
});
```

### With Options

```typescript
sodaGqlPlugin({
  configPath: "./custom.config.ts",
  debug: true,
})
```

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | Auto-detected | Path to config file |
| `debug` | `boolean` | `false` | Enable debug logging |

### Remix

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [remix(), sodaGqlPlugin()],
});
```

### Astro

```typescript
// astro.config.mjs
import { defineConfig } from "astro/config";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  vite: {
    plugins: [sodaGqlPlugin()],
  },
});
```

## Expo / React Native (metro-plugin)

### Installation

```bash
bun add -D @soda-gql/metro-plugin
```

### Expo Configuration

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);
module.exports = withSodaGql(config);
```

### React Native CLI Configuration

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = {};
module.exports = withSodaGql(mergeConfig(getDefaultConfig(__dirname), config));
```

### With Options

```javascript
module.exports = withSodaGql(config, {
  configPath: "./soda-gql.config.ts",
  debug: true,
});
```

### Cache Clearing

Metro uses cache-based invalidation. Clear cache when needed:

```bash
# Expo
npx expo start --clear

# React Native
npx react-native start --reset-cache
```

## NestJS (tsc-plugin)

### Installation

```bash
bun add -D @soda-gql/tsc-plugin
```

### Configuration

```json
// nest-cli.json
{
  "compilerOptions": {
    "builder": "tsc",
    "plugins": [
      {
        "name": "@soda-gql/tsc-plugin",
        "options": {
          "configPath": "./soda-gql.config.ts",
          "importIdentifier": "@/graphql-system"
        }
      }
    ]
  }
}
```

### Plugin Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `configPath` | `string` | Yes | Path to config file |
| `importIdentifier` | `string` | Yes | Import path for GraphQL system |

### Important Notes

- Must use `"builder": "tsc"` (not `"swc"`)
- `importIdentifier` must match your actual import path
- Works with ts-patch for non-NestJS TypeScript projects

## Babel Plugin (babel-plugin)

### Installation

```bash
bun add -D @soda-gql/babel-plugin
```

### Babel Configuration

```javascript
// babel.config.js
module.exports = {
  presets: ["@babel/preset-typescript"],
  plugins: [
    [
      "@soda-gql/babel-plugin",
      {
        configPath: "./soda-gql.config.ts",
        importIdentifier: "@/graphql-system",
      },
    ],
  ],
};
```

### Plugin Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `configPath` | `string` | Yes | Path to config file |
| `importIdentifier` | `string` | Yes | Import path for GraphQL system |

### When to Use

- Custom build setups not covered by other plugins
- Fine-grained control over Babel transformations
- Integration with unsupported bundlers

All higher-level plugins use babel-plugin internally.

## Troubleshooting

### "Transformations not applied"

1. Verify plugin is correctly configured
2. Check files match `include` patterns in config
3. Run `bun run soda-gql codegen` to generate system
4. Enable `debug: true` to see transformation logs

### "Cannot find module '@/graphql-system'"

1. Run `bun run soda-gql codegen`
2. Check `tsconfig.json` paths configuration
3. Verify `outdir` matches import path

### webpack-plugin: Loader not running

Ensure both plugin AND loader are configured:

```javascript
// Plugin generates artifacts
config.plugins.push(new SodaGqlWebpackPlugin({ ... }));

// Loader transforms code
config.module.rules.push({
  test: /\.tsx?$/,
  use: [{ loader: "@soda-gql/webpack-plugin/loader", ... }],
});
```

### vite-plugin: HMR not updating

1. Check browser console for errors
2. Restart Vite dev server
3. Clear browser cache

### metro-plugin: Changes not reflected

Clear Metro cache:
```bash
npx expo start --clear
# or
npx react-native start --reset-cache
```

### tsc-plugin: Plugin not executing

1. Verify `"builder": "tsc"` (not `"swc"`)
2. Check plugin is listed in `compilerOptions.plugins`
3. Verify `importIdentifier` matches import path exactly
