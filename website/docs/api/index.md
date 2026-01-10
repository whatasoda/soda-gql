# API Reference

This section documents the public APIs of soda-gql packages.

:::warning Work in Progress
API documentation is being developed. Some sections may be incomplete.
:::

## Packages

soda-gql is a monorepo with multiple packages. Here's an overview:

### Core Packages

| Package | Description |
|---------|-------------|
| [@soda-gql/core](/api/packages/core) | Core GraphQL types, utilities, and primitives |
| [@soda-gql/runtime](/api/packages/runtime) | Runtime execution helpers and adapters |
| [@soda-gql/cli](/api/packages/cli) | Command-line interface for codegen |
| [@soda-gql/config](/api/packages/config) | Configuration utilities |

### Transformer Packages

| Package | Description |
|---------|-------------|
| @soda-gql/babel | Babel transformer and plugin (`/plugin` export) |
| @soda-gql/tsc | TypeScript transformer and plugin (`/plugin` export) |
| @soda-gql/swc | SWC-based native transformer |

### Build Plugins

| Package | Description |
|---------|-------------|
| @soda-gql/webpack-plugin | Webpack integration with HMR |
| @soda-gql/vite-plugin | Vite bundler plugin |
| @soda-gql/metro-plugin | React Native / Expo Metro plugin |

### Internal Packages

| Package | Description |
|---------|-------------|
| @soda-gql/codegen | Schema code generation |
| @soda-gql/builder | Static analysis, artifact generation, and plugin support utilities (`/plugin-support` export) |
| @soda-gql/common | Shared utilities |

## Version Compatibility

soda-gql is currently at **v0.1.0** (pre-release). APIs may change between minor versions. Once we reach v1.0.0, we will follow semantic versioning strictly.
