# @soda-gql/babel-plugin

> **Note**: This package is not yet published to npm. It is under active development and will be available in a future release.

Babel plugin for soda-gql zero-runtime GraphQL transformations.

## Features

- Transforms `gql.default()` calls to runtime registrations at build time
- Removes GraphQL system imports and injects runtime imports
- Supports both ESM and CommonJS module formats
- Full TypeScript support
- HMR-ready for development workflows

## Installation

```bash
bun add -D @soda-gql/babel-plugin @soda-gql/cli
bun add @soda-gql/runtime
```

## Quick Start

### Babel Configuration

Add the plugin to your Babel configuration:

```javascript
// babel.config.js
module.exports = {
  plugins: [
    [
      "@soda-gql/babel-plugin",
      {
        configPath: "./soda-gql.config.ts",
        artifact: {
          useBuilder: true,
        },
      },
    ],
  ],
};
```

### Project Setup

1. Generate your GraphQL system:

```bash
bun run soda-gql codegen
```

2. Write GraphQL operations:

```typescript
import { gql } from "@/graphql-system";

export const userQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);
```

3. The plugin transforms this to runtime calls:

```typescript
import { gqlRuntime } from "@soda-gql/runtime";

export const userQuery = gqlRuntime.getOperation("canonicalId");
```

## Configuration Options

### `PluginOptions`

```typescript
interface PluginOptions {
  /** Path to soda-gql.config.ts */
  configPath?: string;

  /** Artifact configuration */
  artifact?: {
    /** Use builder to generate artifacts (default: true) */
    useBuilder?: boolean;
    /** Path to pre-built artifact.json */
    path?: string;
  };

  /** Development mode options */
  dev?: {
    /** Enable HMR support (default: false) */
    hmr?: boolean;
  };
}
```

### Configuration Examples

#### Production Build

```javascript
{
  plugins: [
    [
      "@soda-gql/babel-plugin",
      {
        configPath: "./soda-gql.config.ts",
        artifact: {
          useBuilder: true,
        },
      },
    ],
  ],
}
```

#### Development with HMR

```javascript
{
  plugins: [
    [
      "@soda-gql/babel-plugin",
      {
        configPath: "./soda-gql.config.ts",
        artifact: {
          useBuilder: true,
        },
        dev: {
          hmr: true,
        },
      },
    ],
  ],
}
```

#### Using Pre-built Artifact

```javascript
{
  plugins: [
    [
      "@soda-gql/babel-plugin",
      {
        artifact: {
          useBuilder: false,
          path: "./dist/artifact.json",
        },
      },
    ],
  ],
}
```

## Module Format Support

The plugin automatically handles both ESM and CommonJS:

**Input (ESM)**:
```typescript
import { gql } from "@/graphql-system";
export const fragment = gql.default(/* ... */);
```

**Output (ESM)**:
```typescript
import { gqlRuntime } from "@soda-gql/runtime";
export const fragment = gqlRuntime.fragment("canonicalId", /* ... */);
```

**Output (CommonJS)** - when using `@babel/plugin-transform-modules-commonjs`:
```javascript
const { gqlRuntime } = require("@soda-gql/runtime");
module.exports.fragment = gqlRuntime.fragment("canonicalId", /* ... */);
```

## Architecture

### Transformation Pipeline

1. **Metadata Collection**: Analyzes AST to identify `gql.default()` calls
2. **Canonical ID Resolution**: Maps each call to a unique identifier (file path + AST path)
3. **Artifact Lookup**: Retrieves build artifacts for each GraphQL element
4. **AST Transformation**: Replaces builder calls with runtime calls
5. **Import Management**: Removes GraphQL system imports, adds runtime imports

### Supported GraphQL Elements

- **Fragments**: Fragment definitions with data normalization
- **Operations**: Query/mutation/subscription operations with field selections

## Comparison with Other Plugins

| Feature | babel-plugin | plugin-swc | tsc-plugin |
|---------|--------------|------------|------------|
| Production Ready | ✅ | 🚧 In Development | ✅ |
| ESM Support | ✅ | ✅ | ✅ |
| CJS Support | ✅ | ✅ | ✅ |
| HMR Support | ✅ | ⚠️ Planned | ✅ |
| Build Speed | Good | Excellent | Fair |
| Setup Complexity | Low | Low | Medium |

## Troubleshooting

### Plugin Not Transforming Code

- Verify `configPath` points to a valid config file
- Ensure GraphQL system is generated (`bun run soda-gql codegen`)
- Check Babel is processing your source files

### Type Errors After Transformation

- Ensure `@soda-gql/runtime` is installed
- Verify GraphQL system types are up to date
- Check `tsconfig.json` includes transformed files

### Module Not Found Errors

- Confirm runtime import path is correct
- For CJS, ensure `@babel/plugin-transform-modules-commonjs` is configured
- Check module resolution in your bundler

## Contributing

See the main [CLAUDE.md](../../CLAUDE.md) for contribution guidelines.

## License

MIT
