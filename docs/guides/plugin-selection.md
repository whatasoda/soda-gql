# Plugin Selection Guide

This guide helps you choose the right soda-gql build plugin for your project.

## Quick Reference

| Framework | Recommended Plugin | Package |
|-----------|-------------------|---------|
| Next.js (App Router / Pages) | webpack-plugin | `@soda-gql/webpack-plugin` |
| Vite / Remix / Astro | vite-plugin | `@soda-gql/vite-plugin` |
| Expo / React Native | metro-plugin | `@soda-gql/metro-plugin` |
| NestJS | tsc/plugin | `@soda-gql/tsc` |
| Custom Babel setup | babel/plugin | `@soda-gql/babel` |

## Plugin Comparison

| Feature | webpack | vite | metro | tsc | babel |
|---------|---------|------|-------|-----|-------|
| Zero-config | ❌ | ✅ | ✅ | ❌ | ❌ |
| HMR Support | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Dependency Tracking | ✅ | ✅ | ✅ | ❌ | ❌ |
| ESM Output | ✅ | ✅ | ✅ | ✅ | ✅ |
| CJS Output | ✅ | ✅ | ✅ | ✅ | ✅ |

**Legend**: ✅ Full support | ⚠️ Partial (cache-based) | ❌ Not applicable

## Framework-Specific Setup

### Next.js

Use `@soda-gql/webpack-plugin` for Next.js projects (both App Router and Pages Router).

```javascript
// next.config.js
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = {
  webpack: (config, { dev }) => {
    config.plugins.push(
      new SodaGqlWebpackPlugin({
        configPath: "./soda-gql.config.ts",
        debug: dev,
      })
    );

    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: "@soda-gql/webpack-plugin/loader",
          options: { configPath: "./soda-gql.config.ts" },
        },
      ],
    });

    return config;
  },
};
```

### Vite / React

Use `@soda-gql/vite-plugin` for Vite-based projects.

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [react(), sodaGqlPlugin()],
});
```

### Expo / React Native

Use `@soda-gql/metro-plugin` for React Native and Expo projects.

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);
module.exports = withSodaGql(config);
```

### NestJS

Use `@soda-gql/tsc` (with `/plugin` export) for NestJS or ts-patch projects.

```json
// nest-cli.json
{
  "compilerOptions": {
    "builder": "tsc",
    "plugins": [
      {
        "name": "@soda-gql/tsc/plugin",
        "options": {
          "configPath": "./soda-gql.config.ts",
          "importIdentifier": "@/graphql-system"
        }
      }
    ]
  }
}
```

## When to Use babel/plugin Directly

Use `@soda-gql/babel/plugin` when:

- You have a custom build setup not covered by other plugins
- You need fine-grained control over Babel transformations
- You're integrating with an unsupported bundler

All higher-level plugins (webpack, vite, metro) use @soda-gql/babel internally.

## Common Issues

### "Transformations not applied"

1. Verify the plugin is correctly configured in your build tool
2. Check that files match the `include` patterns in `soda-gql.config.ts`
3. Ensure GraphQL system is generated: `bun run soda-gql codegen`

### "Cannot find module '@/graphql-system'"

1. Run `bun run soda-gql codegen` to generate the GraphQL system
2. Verify `tsconfig.json` paths are configured correctly
3. Check that `outdir` in config matches your import path

See [Troubleshooting Guide](../troubleshooting.md) for more solutions.
