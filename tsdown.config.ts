import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "tsdown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(__dirname, "packages");

// Auto-discover packages with exports.json
function discoverPackages(): string[] {
  const dirs = readdirSync(packagesDir, { withFileTypes: true });
  return dirs
    .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, "exports.json")))
    .map((d) => {
      const packageJsonPath = join(packagesDir, d.name, "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      return packageJson.name as string;
    });
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

// Discover all packages with exports.json
const packageNames = discoverPackages();

// Build packageEntries by reading all exports.json files
const packageEntries: Record<string, Record<string, string>> = Object.fromEntries(
  packageNames.map((name) => {
    const shortName = name.replace(/^@soda-gql\//, "");
    const exportsPath = join(packagesDir, shortName, "exports.json");
    const exportsJson = JSON.parse(readFileSync(exportsPath, "utf-8"));
    return [name, normalizeEntries(exportsJson, shortName)];
  }),
);

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

const configure = (name: string, options: ConfigureOptions = {}) => {
  const shortName = name.replace(/^@soda-gql\//, "");
  const entry = packageEntries[name];
  if (!entry) {
    throw new Error(`Package "${name}" not found. Make sure it has exports.json`);
  }
  return {
    name,
    outDir: `packages/${shortName}/dist`,
    entry,
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

  // CLI package (CJS for maximum compatibility)
  {
    ...configure("@soda-gql/cli"),
    format: ["cjs"],
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
