import { resolve } from "node:path";
import { defineConfig, type UserConfig } from "tsdown";
import { packageEntries } from "./scripts/generated/exports-manifest.js";

const aliases = Object.fromEntries(
  Object.entries(packageEntries).flatMap(([pkg, exports]) =>
    Object.entries(exports).map(([name, path]) => [
      resolve(`/${pkg}`, name.replace(/(?<=^|\/)index$/, ".")).slice(1),
      [`./${path}`],
    ]),
  ),
);

const workspaceExternal = (
  self: string,
  {
    extraExternals = [],
    extraNoExternals = [],
  }: { extraExternals?: readonly string[]; extraNoExternals?: readonly string[] } = {},
) => {
  const externals = new Set(extraExternals);
  const noExternals = new Set(extraNoExternals);
  return (id: string) => {
    if (noExternals.has(id)) return false;
    if (id === self || id.startsWith(`${self}/`)) return false;
    if (id.startsWith("@soda-gql/")) return true;
    return externals.has(id);
  };
};

const common = <T extends keyof typeof packageEntries>(name: T) => {
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
  } satisfies UserConfig;
};

export default defineConfig([
  // Core runtime packages
  {
    ...common("@soda-gql/core"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
    external: workspaceExternal("@soda-gql/core", { extraExternals: ["graphql"] }),
  },
  {
    ...common("@soda-gql/runtime"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
    external: workspaceExternal("@soda-gql/runtime", { extraNoExternals: ["@soda-gql/core/runtime"] }),
  },
  {
    ...common("@soda-gql/graffle-client"),
    format: ["esm", "cjs"] as const,
    platform: "neutral" as const,
    external: workspaceExternal("@soda-gql/graffle-client", {
      extraExternals: ["graphql", "graphql-request", "neverthrow"],
    }),
  },

  // Shared/Common packages
  {
    ...common("@soda-gql/common"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: workspaceExternal("@soda-gql/common", {}),
    clean: true,
  },
  {
    ...common("@soda-gql/config"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: workspaceExternal("@soda-gql/config", { extraExternals: ["zod", "esbuild"] }),
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
    external: workspaceExternal("@soda-gql/builder", {
      extraExternals: ["@rspack/core", "@swc/core", "@swc/types", "memfs", "neverthrow", "typescript", "zod"],
    }),
    clean: true,
  },
  {
    ...common("@soda-gql/codegen"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    treeshake: false,
    external: workspaceExternal("@soda-gql/codegen", { extraExternals: ["graphql", "zod"] }),
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
    external: workspaceExternal("@soda-gql/cli", { extraExternals: ["neverthrow", "zod"] }),
    clean: true,
  },

  // Plugin packages (externalize host bundler deps)
  {
    ...common("@soda-gql/plugin-shared"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    external: workspaceExternal("@soda-gql/plugin-shared", { extraExternals: ["neverthrow", "zod"] }),
    clean: true,
  },
  {
    ...common("@soda-gql/plugin-babel"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    external: workspaceExternal("@soda-gql/plugin-babel", {
      extraExternals: ["@babel/core", "@babel/parser", "@babel/traverse", "@babel/types", "neverthrow", "zod"],
    }),
    clean: true,
  },
  {
    ...common("@soda-gql/plugin-webpack"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    external: workspaceExternal("@soda-gql/plugin-webpack", {
      extraExternals: ["@babel/core", "@babel/parser", "@babel/traverse", "@babel/types", "webpack", "zod"],
    }),
    clean: true,
  },
  {
    ...common("@soda-gql/plugin-nestjs"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    external: workspaceExternal("@soda-gql/plugin-nestjs", { extraExternals: ["neverthrow", "zod"] }),
    clean: true,
  },
]);
