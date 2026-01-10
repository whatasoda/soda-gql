# @soda-gql/swc

High-performance native transformer for soda-gql using SWC and Rust. This package provides the fastest transformation option for large codebases.

## Features

- **Native performance** - Rust-based NAPI module for maximum speed
- **Source map chaining** - Merges with upstream source maps
- **Per-file artifact filtering** - Minimizes serialization overhead
- **Cross-platform support** - macOS, Linux, and Windows binaries

## Installation

```bash
npm install @soda-gql/swc
# or
bun add @soda-gql/swc
```

## Usage

This package is typically used through higher-level plugins:

- `@soda-gql/webpack-plugin` - Uses SWC transformer when available
- Direct usage in custom build pipelines

### Direct Usage

```typescript
import { createTransformer } from "@soda-gql/swc";

// createTransformer is async (loads native module)
const transformer = await createTransformer({
  artifact: builderArtifact,
  config: resolvedConfig,
  sourceMap: true, // optional
});

// transform is synchronous after initialization
const result = transformer.transform({
  sourceCode: source,
  sourcePath: "/path/to/file.ts",
  inputSourceMap: existingSourceMap, // optional
});

if (result.transformed) {
  const { sourceCode, sourceMap, errors } = result;
  // Use transformed code and source map
}
```

## Platform Support

The following platforms are supported with pre-built binaries:

| Platform | Architecture | Package |
|----------|--------------|---------|
| macOS | ARM64 | `@soda-gql/swc-darwin-arm64` |
| macOS | x64 | `@soda-gql/swc-darwin-x64` |
| Linux | x64 (glibc) | `@soda-gql/swc-linux-x64-gnu` |
| Linux | x64 (musl) | `@soda-gql/swc-linux-x64-musl` |
| Windows | x64 | `@soda-gql/swc-win32-x64-msvc` |

Platform-specific packages are installed automatically as optional dependencies.

## Requirements

- Node.js >= 18
- `@swc/core` >= 1.0.0 (peer dependency)

## Related Packages

- [@soda-gql/babel](../babel) - Babel-based alternative
- [@soda-gql/webpack-plugin](../webpack-plugin) - Webpack integration
- [@soda-gql/builder](../builder) - Static analysis and artifact generation

## License

MIT
