# @soda-gql/plugin-webpack

> **Note**: This package is not yet published to npm. It is under active development and will be available in a future release.

Webpack loader for soda-gql zero-runtime GraphQL transformations.

## Features

- Transforms `gql.default()` calls to runtime registrations at build time
- Removes GraphQL system imports and injects runtime imports
- Compatible with both Webpack 5 and Next.js Turbopack
- Full TypeScript support
- HMR-ready for development workflows

## Installation

```bash
bun add -D @soda-gql/plugin-webpack @soda-gql/cli webpack
bun add @soda-gql/runtime
```

## Quick Start

### Standard Webpack Configuration

Add the loader to your Webpack configuration:

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: '@soda-gql/plugin-webpack',
            options: {
              configPath: './soda-gql.config.ts'
            }
          }
        ]
      }
    ]
  }
};
```

### Next.js Integration

#### Using Webpack (Default in Next.js < 15)

```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /node_modules/,
      use: [
        {
          loader: '@soda-gql/plugin-webpack',
          options: {
            configPath: './soda-gql.config.ts'
          }
        }
      ]
    });
    return config;
  }
};
```

#### Using Turbopack (Default in Next.js >= 15)

```javascript
// next.config.js
module.exports = {
  turbopack: {
    rules: {
      '**/*.{ts,tsx}': {
        loaders: [
          {
            loader: '@soda-gql/plugin-webpack',
            options: {
              configPath: './soda-gql.config.ts'
            }
          }
        ],
        as: '*.js',
      },
    },
  },
};
```

**Note**: When using Turbopack, you can still customize the webpack configuration for compatibility mode. The above configuration works with both modes.

### Project Setup

1. Generate your GraphQL system:

```bash
bun run soda-gql codegen
```

2. Write GraphQL operations:

```typescript
import { gql } from "@/graphql-system";

export const userQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => ({
      user: f.user({ id: $.id })(({ f }) => [f.id(), f.name()]),
    }),
  ),
);
```

3. The loader transforms this to runtime calls:

```typescript
import { gqlRuntime } from "@soda-gql/runtime";

export const userQuery = gqlRuntime.getComposedOperation("canonicalId");
gqlRuntime.composedOperation("canonicalId", { /* ... */ });
```

## Configuration Options

### `WebpackLoaderOptions`

```typescript
interface WebpackLoaderOptions {
  /** Path to soda-gql.config.ts (default: './soda-gql.config.ts') */
  configPath?: string;

  /** Enable/disable the loader (default: true) */
  enabled?: boolean;
}
```

### Configuration Examples

#### Development Build

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: '@soda-gql/plugin-webpack',
            options: {
              configPath: './soda-gql.config.ts'
            }
          }
        ]
      }
    ]
  }
};
```

#### Conditional Enablement

```javascript
// webpack.config.js
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: '@soda-gql/plugin-webpack',
            options: {
              configPath: './soda-gql.config.ts',
              enabled: isProduction // Only enable in production
            }
          }
        ]
      }
    ]
  }
};
```

## Next.js Specific Configuration

### App Router Support

The plugin works seamlessly with Next.js App Router (React Server Components):

```javascript
// next.config.js
module.exports = {
  turbopack: {
    rules: {
      '**/*.{ts,tsx}': {
        loaders: [{
          loader: '@soda-gql/plugin-webpack',
          options: { configPath: './soda-gql.config.ts' }
        }],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    // Fallback for when Turbopack is not used
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /node_modules/,
      use: [{
        loader: '@soda-gql/plugin-webpack',
        options: { configPath: './soda-gql.config.ts' }
      }]
    });
    return config;
  }
};
```

### Pages Router Support

Works exactly the same as App Router - no special configuration needed.

## Turbopack Compatibility

This loader is fully compatible with Next.js Turbopack. Key points:

- **Loader API Subset**: Turbopack supports a subset of the Webpack loader API
- **JavaScript Output**: The loader returns JavaScript code (required by Turbopack)
- **Simple Options**: Options use only primitive types (strings, booleans)
- **Pattern Matching**: Use glob patterns like `**/*.{ts,tsx}` for file matching

### Turbopack Configuration Format

```javascript
module.exports = {
  turbopack: {
    rules: {
      // Pattern matches files (use ** for subdirectories)
      '**/*.{ts,tsx}': {
        // Loader array (can have multiple loaders)
        loaders: [
          {
            loader: '@soda-gql/plugin-webpack',
            options: { configPath: './soda-gql.config.ts' }
          }
        ],
        // Output type (Turbopack requirement)
        as: '*.js',
      },
    },
  },
};
```

## Architecture

### How It Works

1. **Quick Filter**: Skips files without `gql.` or `gql()` calls
2. **Plugin Session**: Creates session with config and artifact builder
3. **Babel Transform**: Uses `@soda-gql/plugin-babel` internally for transformation
4. **Runtime Injection**: Replaces builder calls with runtime registrations
5. **Source Maps**: Preserves source maps for debugging

### Supported File Types

- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- Declaration files: `.d.ts` (passed through unchanged)

### Supported GraphQL Elements

- **Models**: Fragment definitions with data normalization
- **Slices**: Reusable query/mutation/subscription fragments
- **Operations**: Composed operations from multiple slices
- **Inline Operations**: Self-contained operations

## Comparison with Other Plugins

| Feature | plugin-webpack | plugin-vite | plugin-babel | tsc-plugin |
|---------|----------------|-------------|--------------|------------|
| Production Ready | ✅ | ✅ | ✅ | ✅ |
| Webpack Support | ✅ | ❌ | ✅ (indirect) | ❌ |
| Turbopack Support | ✅ | ❌ | ❌ | ❌ |
| Vite Support | ❌ | ✅ | ❌ | ❌ |
| Next.js Support | ✅ Best | ⚠️ Via Vite | ⚠️ Custom config | ❌ |
| HMR Support | ✅ | ✅ | ✅ | ✅ |
| Build Speed | Good | Excellent | Good | Fair |
| Setup Complexity | Low | Low | Low | Medium |

## Troubleshooting

### Loader Not Transforming Code

- Verify `configPath` points to a valid config file
- Ensure GraphQL system is generated (`bun run soda-gql codegen`)
- Check Webpack/Turbopack is processing your source files
- Verify the loader is placed before TypeScript loader (if using ts-loader)

### Type Errors After Transformation

- Ensure `@soda-gql/runtime` is installed
- Verify GraphQL system types are up to date
- Check `tsconfig.json` includes transformed files

### Next.js Build Errors

- Make sure the loader is configured for both `webpack` and `turbopack`
- Check file patterns match your source files
- Verify no conflicts with other loaders (like swc-loader)

### Turbopack Specific Issues

- Ensure options are simple types (no functions or require())
- Check pattern syntax (use `**` for recursive matching)
- Verify `as: '*.js'` is specified

## Performance Tips

1. **Exclude node_modules**: Always exclude node_modules to speed up builds
2. **File Pattern Optimization**: Use specific patterns like `**/*.{ts,tsx}` instead of `**/*`
3. **Conditional Loading**: Disable in development if not needed
4. **Cache**: The loader is cacheable - Webpack will cache results automatically

## Migration from plugin-next

If you were using the deprecated `@soda-gql/plugin-next`:

```diff
- import { withSodaGql } from '@soda-gql/plugin-next';
-
- export default withSodaGql({
-   // Next.js config
- }, {
-   configPath: './soda-gql.config.ts'
- });

+ module.exports = {
+   turbopack: {
+     rules: {
+       '**/*.{ts,tsx}': {
+         loaders: [{
+           loader: '@soda-gql/plugin-webpack',
+           options: { configPath: './soda-gql.config.ts' }
+         }],
+         as: '*.js',
+       },
+     },
+   },
+   webpack: (config) => {
+     config.module.rules.push({
+       test: /\.(ts|tsx)$/,
+       use: [{
+         loader: '@soda-gql/plugin-webpack',
+         options: { configPath: './soda-gql.config.ts' }
+       }]
+     });
+     return config;
+   }
+ };
```

## Contributing

See the main [CLAUDE.md](../../CLAUDE.md) for contribution guidelines.

## License

MIT
