# @soda-gql/webpack-plugin

Webpack plugin for soda-gql with incremental rebuild and HMR support.

## Installation

```bash
npm install @soda-gql/webpack-plugin
# or
yarn add @soda-gql/webpack-plugin
# or
bun add @soda-gql/webpack-plugin
```

## Usage

### webpack.config.js

```javascript
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = {
  plugins: [
    new SodaGqlWebpackPlugin({
      // Optional: Path to soda-gql config file
      configPath: "./soda-gql.config.ts",

      // Optional: Enable/disable the plugin (default: true)
      enabled: process.env.NODE_ENV !== "test",

      // Optional: Enable debug logging (default: false)
      debug: process.env.DEBUG === "true",
    }),
  ],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          // Your existing loaders (ts-loader, babel-loader, etc.)
          "ts-loader",

          // Add soda-gql loader
          {
            loader: "@soda-gql/webpack-plugin/loader",
            options: {
              // Same options as plugin
              configPath: "./soda-gql.config.ts",
            },
          },
        ],
      },
    ],
  },
};
```

### With webpack-dev-server

The plugin automatically handles HMR (Hot Module Replacement) for soda-gql files.
When a model file changes, all dependent slices and operations are automatically rebuilt.

```javascript
// webpack.config.js
module.exports = {
  devServer: {
    hot: true,
  },
  plugins: [
    new SodaGqlWebpackPlugin({
      debug: true, // Enable to see rebuild logs
    }),
  ],
  // ... rest of config
};
```

## How It Works

1. **Plugin Initialization**: On `beforeRun` hook, the plugin initializes and builds the initial artifact.

2. **Watch Mode**: On `watchRun` hook, the plugin:
   - Rebuilds the artifact (detects file changes automatically)
   - Computes which files are affected by the changes
   - Shares the updated artifact with the loader

3. **Loader Processing**: The loader:
   - Uses the pre-built artifact from the plugin (shared state)
   - Transforms soda-gql code using the Babel plugin
   - Adds file dependencies for proper HMR propagation

## Options

### SodaGqlWebpackPlugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | `undefined` | Path to soda-gql config file |
| `enabled` | `boolean` | `true` | Enable/disable the plugin |
| `include` | `RegExp \| RegExp[]` | `undefined` | File patterns to include |
| `exclude` | `RegExp \| RegExp[]` | `undefined` | File patterns to exclude |
| `debug` | `boolean` | `false` | Enable verbose logging |

### Loader Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | `undefined` | Path to soda-gql config file |
| `enabled` | `boolean` | `true` | Enable/disable the loader |

## Dependency Tracking

The plugin tracks dependencies between soda-gql files:

- **Models**: Base definitions (no dependencies)
- **Operations**: Reference models via `model.spread()`

When a model file changes:
1. The model is rebuilt
2. All operations that use the model are rebuilt

This ensures that changes propagate correctly through the dependency chain.

## License

MIT
