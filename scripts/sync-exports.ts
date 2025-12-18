import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");
const STATIC_EXPORTS = ["./package.json"];

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
  entry: Record<string, string>;
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

function sourceToDistPath(sourcePath: string, ext: DistExt, platform: "node" | "neutral"): string {
  // sourcePath is like "packages/core/src/index.ts"
  // We need to convert to "./dist/index.{ext}"
  const parts = sourcePath.split("/");
  // Find the "src" part and replace with "dist"
  const srcIndex = parts.indexOf("src");
  if (srcIndex === -1) {
    throw new Error(`Source path does not contain 'src': ${sourcePath}`);
  }
  const distParts = [".", "dist", ...parts.slice(srcIndex + 1)];
  const withoutExt = distParts.join("/").replace(/\.(ts|tsx|mts|cts)$/, "");

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

  return `${withoutExt}${extMap[platform][ext]}`;
}

function entryKeyToExportKey(entryKey: string): string {
  // Convert entry key to export key:
  // "index" -> "."
  // "foo/index" -> "./foo"
  // "foo" -> "./foo"
  if (entryKey === "index") {
    return ".";
  }
  const withoutIndex = entryKey.replace(/\/index$/, "");
  return `./${withoutIndex}`;
}

function generateExportsEntry(
  sourcePath: string,
  format: readonly ("esm" | "cjs")[],
  platform: "node" | "neutral",
) {
  const hasEsm = format.includes("esm");
  const hasCjs = format.includes("cjs");

  // Convert full path to relative source path for "@soda-gql" field
  // e.g., "packages/core/src/index.ts" -> "./src/index.ts"
  const parts = sourcePath.split("/");
  const srcIndex = parts.indexOf("src");
  const relativeSrc = "./" + parts.slice(srcIndex).join("/");

  const entry: Record<string, string> = {
    "@soda-gql": relativeSrc,
    types: sourceToDistPath(sourcePath, hasEsm ? "esm-dts" : "cjs-dts", platform),
  };

  if (hasEsm) {
    entry.import = sourceToDistPath(sourcePath, "esm-js", platform);
  }
  if (hasCjs) {
    entry.require = sourceToDistPath(sourcePath, "cjs-js", platform);
  }

  // Set default based on available formats (ESM preferred)
  entry.default = hasEsm
    ? sourceToDistPath(sourcePath, "esm-js", platform)
    : sourceToDistPath(sourcePath, "cjs-js", platform);

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

  // Generate exports object
  const exports: Record<string, unknown> = {};

  for (const [entryKey, sourcePath] of Object.entries(config.entry)) {
    const exportKey = entryKeyToExportKey(entryKey);
    exports[exportKey] = generateExportsEntry(sourcePath, format, platform);
  }

  // Add static exports
  for (const staticExport of STATIC_EXPORTS) {
    exports[staticExport] = staticExport;
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

  const exportCount = Object.keys(config.entry).length;
  const formatStr = format.join("+");
  console.log(`  ✓ ${shortName}: ${exportCount} export${exportCount === 1 ? "" : "s"} (${formatStr}, ${platform})`);
}

async function main() {
  console.log("Syncing package exports from tsdown.config.ts...\n");

  const configs = await loadTsdownConfigs();

  for (const config of configs) {
    try {
      await syncPackageExports(config);
    } catch (error) {
      const shortName = config.name.replace(/^@soda-gql\//, "");
      console.error(`  ✗ ${shortName}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  console.log("\n✓ All packages synchronized");
}

main();
