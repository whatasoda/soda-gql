# Next.js + Webpack Plugin Example

This example demonstrates how to integrate soda-gql with Next.js using the webpack plugin.

> **Status**: Pre-release (v0.1.0)
> This example is for testing and development purposes.

## Features

- [x] Next.js 15 App Router
- [x] Webpack plugin integration via `next.config.ts`
- [x] HMR support for soda-gql files
- [x] TypeScript path aliases (`@/graphql-system`)
- [x] API routes with soda-gql operations

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Generate GraphQL system

```bash
bun run codegen
```

This generates the typed GraphQL system in `./graphql-system/`.

### 3. Run development server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the example.

## Project Structure

```
nextjs-webpack/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page (displays operation metadata)
│   │   └── api/
│   │       └── user/route.ts    # API route using soda-gql operations
│   └── graphql/
│       ├── models.ts            # Model definitions
│       ├── slices.ts            # Query/mutation slices
│       └── operations.ts        # Composed operations
├── inject-module/
│   └── runtime-adapter.ts       # Scalar and adapter definitions
├── graphql-system/              # Generated (do not edit)
├── schema.graphql               # GraphQL schema
├── soda-gql.config.ts           # soda-gql configuration
├── next.config.ts               # Next.js + webpack plugin config
├── package.json
└── tsconfig.json
```

## Configuration

### next.config.ts

The webpack plugin is integrated through Next.js's webpack configuration:

```typescript
import type { NextConfig } from "next";
import { SodaGqlWebpackPlugin } from "@soda-gql/webpack-plugin";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    // Add soda-gql webpack plugin
    config.plugins.push(
      new SodaGqlWebpackPlugin({
        configPath: "./soda-gql.config.ts",
        debug: dev,
      }),
    );

    // Add soda-gql loader for TypeScript files
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: "@soda-gql/webpack-plugin/loader",
          options: {
            configPath: "./soda-gql.config.ts",
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;
```

### soda-gql.config.ts

```typescript
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  graphqlSystemAliases: ["@/graphql-system"],
  include: ["./src/**/*.ts", "./src/**/*.tsx"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./inject-module/runtime-adapter.ts",
      scalars: "./inject-module/runtime-adapter.ts",
    },
  },
});
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with HMR |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run codegen` | Generate GraphQL system |

## How It Works

1. **Codegen**: Run `bun run codegen` to generate the typed GraphQL system from your schema
2. **Webpack Plugin**: During build/dev, the plugin intercepts TypeScript files and:
   - Detects soda-gql model/slice/operation definitions
   - Transforms them using the Babel plugin
   - Tracks dependencies for proper HMR propagation
3. **HMR**: When you modify a model file, all dependent slices and operations are automatically rebuilt

## Verification

To verify the webpack plugin is working:

1. Start the dev server: `bun run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Check the operation metadata displayed on the page
4. Modify a file in `src/graphql/` and observe HMR in action
5. Check the console for `[SodaGqlWebpackPlugin]` debug logs

## Troubleshooting

### "Cannot find module '@/graphql-system'"

Run `bun run codegen` to generate the GraphQL system.

### Changes not reflecting

1. Clear the Next.js cache: `rm -rf .next`
2. Restart the dev server

### Build errors

Ensure all dependencies are installed: `bun install`
