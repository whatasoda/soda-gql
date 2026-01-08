import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "tsdown";
import { discoverExports, hasPublicExports } from "./scripts/discover-exports.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(__dirname, "packages");

// Auto-discover packages with @x-* export files
function discoverPackages(): string[] {
  const dirs = readdirSync(packagesDir, { withFileTypes: true });
  return dirs
    .filter((d) => d.isDirectory() && hasPublicExports(join(packagesDir, d.name)))
    .map((d) => {
      const packageJsonPath = join(packagesDir, d.name, "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      return packageJson.name as string;
    });
}

// Normalize @x-* exports to tsdown entry format
function normalizeEntries(shortName: string): Record<string, string> {
  const packageDir = join(packagesDir, shortName);
  const exports = discoverExports(packageDir);
  const entries: Record<string, string> = {};

  for (const [exportKey, { sourcePath, isDev }] of exports) {
    // Skip dev exports - they aren't built
    if (isDev) continue;

    // Convert export key to entry key:
    // "." -> "index"
    // "./foo" -> "foo"
    let entryKey: string;
    if (exportKey === ".") {
      entryKey = "index";
    } else {
      entryKey = exportKey.replace(/^\.\//, "");
    }

    // Prepend packages/{shortName}/ to the source path (remove leading ./)
    const fullPath = join(`packages/${shortName}`, sourcePath.replace(/^\.\//, ""));
    entries[entryKey] = fullPath;
  }

  return entries;
}

// Discover all packages with @x-* exports
const packageNames = discoverPackages();

// Build packageEntries by scanning @x-* files
const packageEntries: Record<string, Record<string, string>> = Object.fromEntries(
  packageNames.map((name) => {
    const shortName = name.replace(/^@soda-gql\//, "");
    return [name, normalizeEntries(shortName)];
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
    throw new Error(`Package "${name}" not found. Make sure it has @x-* export files`);
  }
  return {
    name,
    outDir: `packages/${shortName}/dist`,
    entry,
    sourcemap: true,
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
      "@babel/generator",
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
      "vite",
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
    ...configure("@soda-gql/colocation-tools"),
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
  {
    ...configure("@soda-gql/typegen"),
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

  // Formatter package (optional CLI dependency)
  {
    ...configure("@soda-gql/formatter"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },

  // Transformer packages
  {
    ...configure("@soda-gql/babel-transformer"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/tsc-transformer"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/swc-transformer"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
    onSuccess: async () => {
      // Copy native module from src/native to dist/native after build
      const { cpSync, existsSync, mkdirSync } = await import("node:fs");
      const srcNative = join(packagesDir, "swc-transformer/src/native");
      const distNative = join(packagesDir, "swc-transformer/dist/native");
      if (existsSync(srcNative)) {
        if (!existsSync(distNative)) {
          mkdirSync(distNative, { recursive: true });
        }
        cpSync(srcNative, distNative, { recursive: true });
        console.log("[swc-transformer] Copied native module to dist/native");
      }
    },
  },

  // Plugin packages (externalize host bundler deps)
  {
    ...configure("@soda-gql/babel-plugin"),
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
    ...configure("@soda-gql/webpack-plugin"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/metro-plugin"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
  {
    ...configure("@soda-gql/vite-plugin"),
    format: ["esm", "cjs"],
    platform: "node",
    target: "node18",
    clean: true,
  },
]);
