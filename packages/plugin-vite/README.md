# @soda-gql/plugin-vite

Vite plugin for soda-gql zero-runtime GraphQL transformations.

## Installation

```bash
bun add -D @soda-gql/plugin-vite
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { sodaGqlVitePlugin } from '@soda-gql/plugin-vite';

export default defineConfig({
  plugins: [
    sodaGqlVitePlugin({
      configPath: './soda-gql.config.ts'
    })
  ]
});
```

### With React

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sodaGqlVitePlugin } from '@soda-gql/plugin-vite';

export default defineConfig({
  plugins: [
    sodaGqlVitePlugin({
      configPath: './soda-gql.config.ts'
    }),
    react()
  ]
});
```

### With Vue

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { sodaGqlVitePlugin } from '@soda-gql/plugin-vite';

export default defineConfig({
  plugins: [
    sodaGqlVitePlugin({
      configPath: './soda-gql.config.ts'
    }),
    vue()
  ]
});
```

## Configuration

### Plugin Options

```typescript
type VitePluginOptions = {
  /**
   * Path to soda-gql config file.
   * @default './soda-gql.config.ts'
   */
  configPath?: string;

  /**
   * Enable/disable the plugin.
   * @default true
   */
  enabled?: boolean;
};
```

### Example: Conditional Enablement

```typescript
import { defineConfig } from 'vite';
import { sodaGqlVitePlugin } from '@soda-gql/plugin-vite';

export default defineConfig({
  plugins: [
    sodaGqlVitePlugin({
      configPath: './soda-gql.config.ts',
      enabled: process.env.NODE_ENV !== 'test'
    })
  ]
});
```

## Features

- **Zero Runtime**: GraphQL operations are transformed at build time
- **HMR Support**: Hot Module Replacement for development
- **SSR Compatible**: Works with Vite SSR builds
- **TypeScript**: Full TypeScript support
- **Source Maps**: Generates source maps for debugging

## How It Works

The Vite plugin integrates soda-gql's zero-runtime transformations into Vite's build pipeline:

1. During development and build, the plugin intercepts `.ts` and `.tsx` files
2. Files containing `gql.` calls are transformed using Babel
3. GraphQL operations are replaced with runtime calls to `@soda-gql/runtime`
4. The original GraphQL system imports are removed
5. HMR updates trigger re-transformation when needed

## Development Mode

In development mode, the plugin:
- Watches for file changes
- Rebuilds the artifact on each transformation
- Supports Hot Module Replacement (HMR)
- Provides detailed error messages

## Production Build

In production mode, the plugin:
- Performs all transformations at build time
- Generates optimized code
- Includes source maps for debugging
- Ensures zero runtime overhead

## Troubleshooting

### Plugin Not Transforming Files

Ensure that:
1. The `configPath` points to a valid soda-gql config file
2. Your config includes the files you want to transform in the `include` pattern
3. The GraphQL schema is properly configured

### HMR Not Working

If HMR isn't working:
1. Check that the Vite dev server is running
2. Verify that your files are being watched
3. Look for errors in the console

### Build Errors

If you encounter build errors:
1. Run `bun typecheck` to verify TypeScript errors
2. Check the soda-gql config is valid
3. Ensure the artifact can be built successfully

## License

MIT
