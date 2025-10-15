import { defineConfig, type UserConfig } from "tsdown";
import { packageEntries } from "./scripts/generated/exports-manifest.js";
import { resolve } from "node:path";

const aliases = Object.fromEntries(Object.entries(packageEntries).flatMap(([pkg, exports]) => Object.entries(exports).map(([name, path]) => [resolve(`/${pkg}`, name.replace(/(?<=^|\/)index$/, ".")).slice(1), [`./${path}`]])));

const common = <T extends keyof typeof packageEntries>(name: T) => {
  const shortName = name.replace(/^@soda-gql\//, "");
  return ({
    name,
    outDir: `packages/${shortName}/dist`,
    entry: packageEntries[name],
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
      compilerOptions: {
        paths: aliases,
      }
    },
  } satisfies UserConfig);
}

export default defineConfig(
  [
    // Core runtime packages
    {
    ...common("@soda-gql/core"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
    external: ["graphql"],
  },
  {
    ...common("@soda-gql/runtime"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
    external: [],
  },

  // Shared/Common packages
  {
    ...common("@soda-gql/common"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: ["@soda-gql/core", "@soda-gql/codegen"],
    clean: true,
  },
  {
    ...common("@soda-gql/config"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: ["@soda-gql/core", "zod", "esbuild"],
    clean: true,
  },

  // Builder and codegen packages (heavy Node usage, avoid tree-shaking)
  {
    ...common("@soda-gql/builder"),
    outDir: "packages/builder/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: [
      "@soda-gql/codegen",
      "@soda-gql/common",
      "@soda-gql/core",
      "@swc/core",
      "@swc/types",
      "neverthrow",
      "typescript",
      "zod",
    ],
    clean: true,
  },
  {
    ...common("@soda-gql/codegen"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: ["@soda-gql/core", "@soda-gql/common", "graphql", "zod"],
    clean: true,
  },

  // CLI package (needs shebang preservation)
  {
    ...common("@soda-gql/cli"),
    format: ["esm"],
    platform: "node",
    target: "node18",
    banner: {
      js: "#!/usr/bin/env bun",
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
    ...common("@soda-gql/plugin-shared"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    external: [
      "@soda-gql/builder",
      "@soda-gql/common",
      "neverthrow",
      "zod",
    ],
    clean: true,
  },
  {
    ...common("@soda-gql/plugin-babel"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
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
    ...common("@soda-gql/plugin-nestjs"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    external: [
      "@soda-gql/builder",
      "@soda-gql/plugin-shared",
      "@babel/core",
      "@babel/parser",
      "@babel/traverse",
      "@babel/types",
      "webpack",
      "neverthrow",
      "zod",
    ],
    clean: true,
  },
]);
