import { defineConfig } from "tsdown";

export default defineConfig([
  // Core runtime packages
  {
    name: "@soda-gql/core",
    entry: {
      index: "packages/core/src/index.ts",
      "runtime/index": "packages/core/src/runtime/index.ts",
    },
    outDir: "packages/core/dist",
    format: ["esm", "cjs"],
    platform: "neutral",
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: ["graphql"],
    clean: true,
  },
  {
    name: "@soda-gql/runtime",
    entry: {
      index: "packages/runtime/src/index.ts",
    },
    outDir: "packages/runtime/dist",
    format: ["esm", "cjs"],
    platform: "neutral",
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: [],
    clean: true,
  },

  // Shared/Common packages
  {
    name: "@soda-gql/common",
    entry: {
      index: "packages/common/src/index.ts",
    },
    outDir: "packages/common/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: ["@soda-gql/core", "@soda-gql/codegen"],
    clean: true,
  },
  {
    name: "@soda-gql/config",
    entry: {
      index: "packages/config/src/index.ts",
    },
    outDir: "packages/config/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: ["@soda-gql/core", "zod"],
    clean: true,
  },

  // Builder and codegen packages (heavy Node usage, avoid tree-shaking)
  {
    name: "@soda-gql/builder",
    entry: {
      index: "packages/builder/src/index.ts",
      types: "packages/builder/src/types.ts",
      "change-set": "packages/builder/src/change-set.ts",
      "artifact/index": "packages/builder/src/artifact/index.ts",
      "schemas/artifact": "packages/builder/src/schemas/artifact.ts",
      service: "packages/builder/src/service.ts",
    },
    outDir: "packages/builder/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: [
      "@soda-gql/codegen",
      "@soda-gql/common",
      "@soda-gql/core",
      "@swc/core",
      "@swc/types",
      "bun",
      "neverthrow",
      "typescript",
      "zod",
    ],
    clean: true,
  },
  {
    name: "@soda-gql/codegen",
    entry: {
      index: "packages/codegen/src/index.ts",
    },
    outDir: "packages/codegen/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: ["@soda-gql/core", "@soda-gql/common", "graphql", "zod"],
    clean: true,
  },

  // CLI package (needs shebang preservation)
  {
    name: "@soda-gql/cli",
    entry: {
      index: "packages/cli/src/index.ts",
    },
    outDir: "packages/cli/dist",
    format: ["esm"],
    platform: "node",
    target: "node18",
    banner: {
      js: "#!/usr/bin/env bun",
    },
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: [
      "@soda-gql/codegen",
      "@soda-gql/builder",
      "neverthrow",
      "zod",
    ],
    clean: true,
  },

  // Plugin packages (externalize host bundler deps)
  {
    name: "@soda-gql/plugin-shared",
    entry: {
      index: "packages/plugin-shared/src/index.ts",
    },
    outDir: "packages/plugin-shared/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: [
      "@soda-gql/builder",
      "@soda-gql/common",
      "neverthrow",
      "zod",
    ],
    clean: true,
  },
  {
    name: "@soda-gql/plugin-babel",
    entry: {
      index: "packages/plugin-babel/src/index.ts",
      "adapter/index": "packages/plugin-babel/src/adapter/index.ts",
      "dev/index": "packages/plugin-babel/src/dev/index.ts",
    },
    outDir: "packages/plugin-babel/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: [
      "@soda-gql/builder",
      "@soda-gql/common",
      "@soda-gql/plugin-shared",
      "@babel/core",
      "@babel/parser",
      "@babel/traverse",
      "@babel/types",
      "neverthrow",
      "zod",
    ],
    clean: true,
  },
  {
    name: "@soda-gql/plugin-nestjs",
    entry: {
      index: "packages/plugin-nestjs/src/index.ts",
    },
    outDir: "packages/plugin-nestjs/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
    },
    external: [
      "@soda-gql/builder",
      "@soda-gql/plugin-shared",
      "webpack",
      "neverthrow",
      "zod",
    ],
    clean: true,
  },
]);
