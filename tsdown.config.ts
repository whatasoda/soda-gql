import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "tsdown";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read exports.json directly from each package
function readExportsJson(packageName: string): Record<string, string> {
  const shortName = packageName.replace(/^@soda-gql\//, "");
  const exportsPath = join(__dirname, `packages/${shortName}/exports.json`);
  return JSON.parse(readFileSync(exportsPath, "utf-8"));
}

// Normalize exports.json entries to tsdown entry format
function normalizeEntries(exportsJson: Record<string, string>, shortName: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(exportsJson).map(([key, sourcePath]) => {
      // Convert export key to entry key:
      // "." -> "index"
      // "./foo" -> "foo/index" (if source ends with /index.ts)
      // "./foo" -> "foo" (otherwise)
      let entryKey: string;
      if (key === ".") {
        entryKey = "index";
      } else {
        entryKey = key.replace(/^\.\//, "");
        if (sourcePath.endsWith("/index.ts")) {
          entryKey = `${entryKey}/index`;
        }
      }
      // Prepend packages/{shortName}/ to the source path (remove leading ./)
      const fullPath = join(`packages/${shortName}`, sourcePath.replace(/^\.\//, ""));
      return [entryKey, fullPath];
    }),
  );
}

// Package names that have exports.json
const packageNames = [
  "@soda-gql/core",
  "@soda-gql/runtime",
  "@soda-gql/graffle-client",
  "@soda-gql/common",
  "@soda-gql/config",
  "@soda-gql/builder",
  "@soda-gql/codegen",
  "@soda-gql/cli",
  "@soda-gql/plugin-babel",
  "@soda-gql/plugin-common",
  "@soda-gql/tsc-plugin",
  "@soda-gql/plugin-vite",
  "@soda-gql/plugin-webpack",
] as const;

type PackageName = (typeof packageNames)[number];

// Build packageEntries by reading all exports.json files
const packageEntries = Object.fromEntries(
  packageNames.map((name) => {
    const shortName = name.replace(/^@soda-gql\//, "");
    const exportsJson = readExportsJson(name);
    return [name, normalizeEntries(exportsJson, shortName)];
  }),
) as Record<PackageName, Record<string, string>>;

// Build aliases for TypeScript path resolution in dts
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

const configure = <T extends PackageName>(name: T, options: ConfigureOptions = {}) => {
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
      "@graphql-typed-document-node/core",
      "@swc/core",
      "@swc/types",
      "esbuild",
      "fast-glob",
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
      js: "#!/usr/bin/env node",
    },
    clean: true,
  },

  // Plugin packages (externalize host bundler deps)
  {
    ...configure("@soda-gql/plugin-babel"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/plugin-common"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/tsc-plugin"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/plugin-vite"),
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
]);
