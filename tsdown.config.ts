import { resolve } from "node:path";
import { defineConfig, type UserConfig } from "tsdown";
import { packageEntries } from "./scripts/generated/exports-manifest";

const aliases = Object.fromEntries(
  Object.entries(packageEntries).flatMap(([pkg, exports]) =>
    Object.entries(exports).map(([name, path]) => [
      resolve(`/${pkg}`, name.replace(/(?<=^|\/)index$/, ".")).slice(1),
      [`./${path}`],
    ]),
  ),
);

type ConfigureOptions = {
  externals?: readonly string[];
  noExternals?: readonly string[];
};

const configure = <T extends keyof typeof packageEntries>(name: T, options: ConfigureOptions = {}) => {
  const shortName = name.replace(/^@soda-gql\//, "");
  return {
    name,
    outDir: `packages/${shortName}/dist`,
    entry: packageEntries[name],
    dts: {
      tsconfig: "./tsconfig.build.json",
      sourcemap: true,
      compilerOptions: {
        paths: aliases,
      },
    },
    external: createExternal(),
  } satisfies UserConfig;

  function createExternal() {
    const externals = new Set(options.externals);
    const noExternals = new Set(options.noExternals);
    const commonExternals = [
      //
      "@babel/core",
      "@babel/parser",
      "@babel/traverse",
      "@babel/types",
      "@swc/core",
      "@swc/types",
      "esbuild",
      "graphql",
      "graphql-request",
      "neverthrow",
      "tsdown",
      "typescript",
      "webpack",
      "xxhash-wasm",
      "zod",
    ];
    return (id: string) => {
      if (noExternals.has(id)) return false;
      if (id === name || id.startsWith(`${name}/`)) return false;
      if (id.startsWith("@soda-gql/") || commonExternals.includes(id)) return true;
      return externals.has(id);
    };
  }
};

export default defineConfig([
  // Core runtime packages
  {
    ...configure("@soda-gql/core"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
  },
  {
    ...configure("@soda-gql/runtime", { noExternals: ["@soda-gql/core/runtime"] }),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
  },
  {
    ...configure("@soda-gql/graffle-client"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
  },

  // Shared/Common packages
  {
    ...configure("@soda-gql/common"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    clean: true,
  },
  {
    ...configure("@soda-gql/config"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    clean: true,
  },

  // Builder and codegen packages (heavy Node usage, avoid tree-shaking)
  {
    ...configure("@soda-gql/builder"),
    outDir: "packages/builder/dist",
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    clean: true,
  },
  {
    ...configure("@soda-gql/codegen"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    clean: true,
  },

  // CLI package (needs shebang preservation)
  {
    ...configure("@soda-gql/cli"),
    format: ["esm"],
    platform: "node",
    target: "node18",
    banner: {
      js: "#!/usr/bin/env bun",
    },
    clean: true,
  },

  // Plugin packages (externalize host bundler deps)
  {
    ...configure("@soda-gql/plugin-shared"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/plugin-babel"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/plugin-webpack"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/plugin-tsc"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/plugin-swc"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
]);
