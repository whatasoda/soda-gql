# @soda-gql/swc-transformer

High-performance native transformer for soda-gql using SWC and Rust. This package provides the fastest transformation option for large codebases.

## Features

- **Native performance** - Rust-based NAPI module for maximum speed
- **Source map chaining** - Merges with upstream source maps
- **Per-file artifact filtering** - Minimizes serialization overhead
- **Cross-platform support** - macOS, Linux, and Windows binaries

## Installation

```bash
npm install @soda-gql/swc-transformer
# or
bun add @soda-gql/swc-transformer
```

## Usage

This package is typically used through higher-level plugins:

- `@soda-gql/webpack-plugin` - Uses SWC transformer when available
- Direct usage in custom build pipelines

### Direct Usage

```typescript
import { createSwcTransformer } from "@soda-gql/swc-transformer";

const transformer = createSwcTransformer({
  artifact: builderArtifact,
  config: resolvedConfig,
});

const result = await transformer.transform({
  source: sourceCode,
  filePath: "/path/to/file.ts",
  inputSourceMap: existingSourceMap, // optional
});

if (result.isOk()) {
  const { code, map } = result.value;
  // Use transformed code and source map
}
```

## Platform Support

The following platforms are supported with pre-built binaries:

| Platform | Architecture | Package |
|----------|--------------|---------|
| macOS | ARM64 | `@soda-gql/swc-transformer-darwin-arm64` |
| macOS | x64 | `@soda-gql/swc-transformer-darwin-x64` |
| Linux | x64 (glibc) | `@soda-gql/swc-transformer-linux-x64-gnu` |
| Linux | x64 (musl) | `@soda-gql/swc-transformer-linux-x64-musl` |
| Windows | x64 | `@soda-gql/swc-transformer-win32-x64-msvc` |

Platform-specific packages are installed automatically as optional dependencies.

## Requirements

- Node.js >= 18
- `@swc/core` >= 1.0.0 (peer dependency)

## Related Packages

- [@soda-gql/babel-transformer](../babel-transformer) - Babel-based alternative
- [@soda-gql/webpack-plugin](../webpack-plugin) - Webpack integration
- [@soda-gql/builder](../builder) - Static analysis and artifact generation

## License

MIT
