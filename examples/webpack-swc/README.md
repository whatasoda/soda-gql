# Webpack + SWC Transformer Example

This example demonstrates using soda-gql with webpack and the SWC transformer for faster build performance.

## Features

- Webpack 5 integration
- SWC transformer (faster than Babel)
- HMR support
- TypeScript path aliases

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Generate GraphQL system

```bash
bun run codegen
```

### 3. Run development server

```bash
bun run dev
```

Open http://localhost:3000 to see the example.

### 4. Production build

```bash
bun run build
```

## Configuration

The SWC transformer is enabled by setting `transformer: "swc"` in both:

- `SodaGqlWebpackPlugin` options (in `webpack.config.js`)
- `@soda-gql/webpack-plugin/loader` options (in `webpack.config.js`)

Both must be set to the same value for proper operation.

```javascript
// webpack.config.js
plugins: [
  new SodaGqlWebpackPlugin({
    configPath: "./soda-gql.config.ts",
    transformer: "swc", // Use SWC transformer
  }),
],
module: {
  rules: [
    {
      test: /\.tsx?$/,
      use: [
        "ts-loader",
        {
          loader: "@soda-gql/webpack-plugin/loader",
          options: {
            configPath: "./soda-gql.config.ts",
            transformer: "swc", // Use SWC transformer
          },
        },
      ],
    },
  ],
},
```

## Performance

SWC transformer provides faster transformation compared to Babel:

- Native Rust implementation via N-API
- Reusable transformer instance across files
- Efficient source map generation
