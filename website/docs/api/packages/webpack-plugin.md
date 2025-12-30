# @soda-gql/webpack-plugin

Webpack plugin for soda-gql transformation with HMR support.

## Installation

```bash
bun add -D @soda-gql/webpack-plugin
```

## Basic Setup

Add the plugin to your Webpack configuration:

```javascript
// webpack.config.js
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = {
  plugins: [
    new SodaGqlWebpackPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          // Your existing loaders (e.g., babel-loader, ts-loader)
          {
            loader: "@soda-gql/webpack-plugin/loader",
          },
        ],
      },
    ],
  },
};
```

## Plugin Options

```javascript
new SodaGqlWebpackPlugin({
  configPath: "./soda-gql.config.ts",  // Custom config file path
  enabled: true,                       // Enable/disable plugin
  debug: false,                        // Enable debug logging
});
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | Auto-detected | Path to soda-gql config file |
| `enabled` | `boolean` | `true` | Enable or disable the plugin |
| `debug` | `boolean` | `false` | Enable debug logging |

## Loader Options

Configure the loader separately if needed:

```javascript
{
  loader: "@soda-gql/webpack-plugin/loader",
  options: {
    // Loader-specific options
  },
}
```

## Features

### Hot Module Replacement

Works with webpack-dev-server for live reloading:

```javascript
module.exports = {
  devServer: {
    hot: true,
  },
  plugins: [
    new SodaGqlWebpackPlugin(),
  ],
};
```

### Dependency Tracking

The plugin tracks dependencies between:
- Fragments and operations
- Operations and their spread fragments

Changes to a fragment automatically invalidate dependent operations.

### SWC Transformer

Uses the SWC transformer for high-performance code transformation.

## With Next.js

Configure in `next.config.js`:

```javascript
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.plugins.push(new SodaGqlWebpackPlugin());

    config.module.rules.push({
      test: /\.[jt]sx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: "@soda-gql/webpack-plugin/loader",
        },
      ],
    });

    return config;
  },
};

module.exports = nextConfig;
```

## With Create React App (Ejected)

After ejecting, modify `config/webpack.config.js`:

```javascript
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = function(webpackEnv) {
  return {
    plugins: [
      // ... other plugins
      new SodaGqlWebpackPlugin(),
    ],
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          include: paths.appSrc,
          use: [
            {
              loader: require.resolve("babel-loader"),
              // ... babel options
            },
            {
              loader: "@soda-gql/webpack-plugin/loader",
            },
          ],
        },
      ],
    },
  };
};
```

## Debugging

Enable debug mode:

```javascript
new SodaGqlWebpackPlugin({
  debug: true,
});
```

Debug output includes:
- Plugin initialization
- Files being processed
- Transformation results
- Cache hits/misses

## Requirements

- Webpack 5.x
- Node.js >= 18
- soda-gql configuration file

## Related

- [Next.js Recipe](/recipes/nextjs) for complete setup guide
- [@soda-gql/config](/api/packages/config) for configuration options
