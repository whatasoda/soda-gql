# @soda-gql/babel-transformer

Core Babel transformation logic for soda-gql. This package provides the AST transformation functionality used by `@soda-gql/babel-plugin`.

## Status

**Internal package** - This package is used internally by soda-gql plugins and is not intended for direct use by end users.

## Purpose

This package provides:

1. **Babel AST transformation** - Transforms `gql.default()` calls to `gqlRuntime.getOperation()` calls
2. **Source map support** - Generates and chains source maps for debugging
3. **Import management** - Handles import rewrites and cleanup

## Used By

- `@soda-gql/babel-plugin` - Babel plugin for build-time transformation
- `@soda-gql/vite-plugin` - Vite plugin (uses Babel internally)
- `@soda-gql/metro-plugin` - Metro plugin for React Native
- `@soda-gql/webpack-plugin` - Webpack plugin (Babel-based loader)

## API

### transformBabel

Transforms a source file using Babel, replacing soda-gql DSL with runtime calls.

```typescript
import { transformBabel } from "@soda-gql/babel-transformer";

const result = await transformBabel({
  source: sourceCode,
  filePath: "/path/to/file.ts",
  artifact: builderArtifact,
  config: resolvedConfig,
});

if (result.isOk()) {
  const { code, map } = result.value;
  // Use transformed code and source map
}
```

## Related Packages

- [@soda-gql/babel-plugin](../babel-plugin) - Babel plugin wrapper
- [@soda-gql/builder](../builder) - Static analysis and artifact generation
- [@soda-gql/plugin-common](../plugin-common) - Shared plugin utilities

## License

MIT
