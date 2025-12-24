import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverExports, hasPublicExports } from "./discover-exports";

const REPO_ROOT = join(import.meta.dir, "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");
const STATIC_EXPORTS = ["./package.json"];

// Packages that manage their own exports (e.g., native modules with custom build systems)
const EXCLUDED_PACKAGES: string[] = [];

// Exports that should be preserved (not overwritten by sync) for hybrid packages
// These are manually managed exports that coexist with auto-synced exports
const PRESERVED_EXPORTS: Record<string, Record<string, unknown>> = {
  "@soda-gql/swc-transformer": {
    "./native": {
      types: "./index.d.ts",
      require: "./index.js",
      default: "./index.js",
    },
  },
};

interface PackageJson {
  name: string;
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TsdownConfig {
  name: string;
  format?: readonly ("esm" | "cjs")[];
  platform?: "node" | "neutral";
}

async function loadTsdownConfigs(): Promise<TsdownConfig[]> {
  const configPath = join(REPO_ROOT, "tsdown.config.ts");
  const module = await import(configPath);
  // tsdown config exports an array wrapped in defineConfig
  return module.default;
}

type DistExt = "esm-js" | "esm-dts" | "cjs-js" | "cjs-dts";

function exportKeyToDistPath(exportKey: string, ext: DistExt, platform: "node" | "neutral"): string {
  // exportKey is like "." or "./runtime" or "./runtime/helpers"
  // We need to convert to "./dist/index.{ext}" or "./dist/runtime.{ext}" or "./dist/runtime/helpers.{ext}"

  // Extension mapping based on platform:
  // - neutral: ESM uses .js/.d.ts, CJS uses .cjs/.d.cts
  // - node: ESM uses .mjs/.d.mts, CJS uses .cjs/.d.cts
  const extMap: Record<"node" | "neutral", Record<DistExt, string>> = {
    neutral: {
      "esm-js": ".js",
      "esm-dts": ".d.ts",
      "cjs-js": ".cjs",
      "cjs-dts": ".d.cts",
    },
    node: {
      "esm-js": ".mjs",
      "esm-dts": ".d.mts",
      "cjs-js": ".cjs",
      "cjs-dts": ".d.cts",
    },
  };

  const basePath = exportKey === "." ? "./dist/index" : `./dist${exportKey.slice(1)}`;
  return `${basePath}${extMap[platform][ext]}`;
}

function generateExportsEntry(
  exportKey: string,
  sourcePath: string,
  format: readonly ("esm" | "cjs")[],
  platform: "node" | "neutral",
  isDev: boolean,
) {
  // Dev-only exports: only @soda-gql condition
  if (isDev) {
    return {
      "@soda-gql": sourcePath,
    };
  }

  const hasEsm = format.includes("esm");
  const hasCjs = format.includes("cjs");

  const entry: Record<string, string> = {
    "@soda-gql": sourcePath,
    types: exportKeyToDistPath(exportKey, hasEsm ? "esm-dts" : "cjs-dts", platform),
  };

  if (hasEsm) {
    entry.import = exportKeyToDistPath(exportKey, "esm-js", platform);
  }
  if (hasCjs) {
    entry.require = exportKeyToDistPath(exportKey, "cjs-js", platform);
  }

  // Set default based on available formats (ESM preferred)
  entry.default = hasEsm
    ? exportKeyToDistPath(exportKey, "esm-js", platform)
    : exportKeyToDistPath(exportKey, "cjs-js", platform);

  return entry;
}

async function syncPackageExports(config: TsdownConfig): Promise<void> {
  const packageName = config.name;
  const shortName = packageName.replace(/^@soda-gql\//, "");
  const packageDir = join(PACKAGES_DIR, shortName);
  const packageJsonPath = join(packageDir, "package.json");

  const format = config.format ?? (["esm", "cjs"] as const);
  const platform = config.platform ?? "node";

  // Read existing package.json
  const packageJsonContent = await readFile(packageJsonPath, "utf-8");
  const packageJson: PackageJson = JSON.parse(packageJsonContent);

  // Discover exports from @x-* and @devx-* files
  const discoveredExports = discoverExports(packageDir);

  // Generate exports object
  const exports: Record<string, unknown> = {};
  let publicExportCount = 0;
  let devExportCount = 0;

  for (const [exportKey, { sourcePath, isDev }] of discoveredExports) {
    exports[exportKey] = generateExportsEntry(exportKey, sourcePath, format, platform, isDev);
    if (isDev) {
      devExportCount++;
    } else {
      publicExportCount++;
    }
  }

  // Add static exports
  for (const staticExport of STATIC_EXPORTS) {
    exports[staticExport] = staticExport;
  }

  // Add preserved exports for hybrid packages (e.g., native module exports)
  const preserved = PRESERVED_EXPORTS[packageName];
  if (preserved) {
    for (const [key, value] of Object.entries(preserved)) {
      exports[key] = value;
    }
  }

  // Update main/module/types from the default export (".")
  const defaultExportEntry = exports["."];
  if (defaultExportEntry && typeof defaultExportEntry === "object") {
    const entry = defaultExportEntry as Record<string, string>;
    packageJson.main = entry.default;
    packageJson.module = entry.import ?? entry.default;
    packageJson.types = entry.types;
  }

  packageJson.exports = exports;

  // Write updated package.json
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  const formatStr = format.join("+");
  const devNote = devExportCount > 0 ? ` + ${devExportCount} dev` : "";
  console.log(`  ✓ ${shortName}: ${publicExportCount} export${publicExportCount === 1 ? "" : "s"}${devNote} (${formatStr}, ${platform})`);
}

async function main() {
  console.log("Syncing package exports from @x-* files...\n");

  const configs = await loadTsdownConfigs();

  for (const config of configs) {
    if (EXCLUDED_PACKAGES.includes(config.name)) {
      const shortName = config.name.replace(/^@soda-gql\//, "");
      console.log(`  ⊘ ${shortName}: skipped (manages own exports)`);
      continue;
    }

    const shortName = config.name.replace(/^@soda-gql\//, "");
    const packageDir = join(PACKAGES_DIR, shortName);

    // Skip packages without @x-* exports
    if (!hasPublicExports(packageDir)) {
      console.log(`  ⊘ ${shortName}: skipped (no @x-* exports)`);
      continue;
    }

    try {
      await syncPackageExports(config);
    } catch (error) {
      console.error(`  ✗ ${shortName}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  console.log("\n✓ All packages synchronized");
}

main();
