# @soda-gql/vite-plugin

Vite plugin for soda-gql transformation with HMR support.

## Installation

```bash
bun add -D @soda-gql/vite-plugin
```

## Basic Setup

Add the plugin to your Vite configuration:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [
    sodaGqlPlugin(),
  ],
});
```

## Plugin Options

```typescript
sodaGqlPlugin({
  configPath: "./soda-gql.config.ts",  // Custom config file path
  include: ["**/*.ts", "**/*.tsx"],    // Override include patterns
  exclude: ["**/node_modules/**"],     // Override exclude patterns
  debug: false,                        // Enable debug logging
});
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | Auto-detected | Path to soda-gql config file |
| `include` | `string[]` | From config | Glob patterns for files to transform |
| `exclude` | `string[]` | From config | Glob patterns to exclude |
| `debug` | `boolean` | `false` | Enable debug logging |

## Features

### Hot Module Replacement (HMR)

The plugin supports Vite's HMR for fast development:

- Fragment and operation changes trigger instant updates
- No full page reload needed for most changes
- Dependency tracking ensures correct invalidation

### Incremental Builds

Only modified files are re-transformed:

- Initial build analyzes all files
- Subsequent builds only process changed files
- Fast rebuilds during development

### SWC Transformer

Uses the high-performance SWC transformer for code transformation:

- Native Rust performance
- Full TypeScript support
- Minimal runtime overhead

## Configuration with React

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sodaGqlPlugin(),
  ],
});
```

## Configuration with Other Frameworks

### Vue

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [
    vue(),
    sodaGqlPlugin(),
  ],
});
```

### Svelte

```typescript
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [
    svelte(),
    sodaGqlPlugin(),
  ],
});
```

## Alternative Import

The plugin is also exported as `withSodaGql`:

```typescript
import { withSodaGql } from "@soda-gql/vite-plugin";

export default defineConfig({
  plugins: [
    withSodaGql(),
  ],
});
```

## Debugging

Enable debug mode to see transformation details:

```typescript
sodaGqlPlugin({
  debug: true,
});
```

This logs:
- Files being transformed
- Operations detected
- Transformation time

## Requirements

- Vite 5.x or 6.x
- Node.js >= 18
- soda-gql configuration file

## Related

- [Vite + React Recipe](/recipes/vite-react) for complete setup guide
- [@soda-gql/config](/api/packages/config) for configuration options
