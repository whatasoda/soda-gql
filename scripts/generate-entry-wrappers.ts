import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { discoverExports, hasPublicExports } from "./discover-exports";

const REPO_ROOT = join(import.meta.dir, "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");

interface TsdownConfig {
  name: string;
  format?: readonly ("esm" | "cjs")[];
  platform?: "node" | "neutral";
}

interface PackageJson {
  name: string;
  files?: string[];
  [key: string]: unknown;
}

async function loadTsdownConfigs(): Promise<TsdownConfig[]> {
  const configPath = join(REPO_ROOT, "tsdown.config.ts");
  const module = await import(configPath);
  return module.default;
}

type DistExt = "esm-js" | "esm-dts" | "cjs-js" | "cjs-dts";

function getDistExtension(ext: DistExt, platform: "node" | "neutral"): string {
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
  return extMap[platform][ext];
}

function exportKeyToEntryName(exportKey: string): string {
  // "." -> "index"
  // "./runtime" -> "runtime"
  // "./_internal" -> "_internal"
  if (exportKey === ".") return "index";
  return exportKey.replace(/^\.\//, "");
}

function generateJsWrapper(
  entryName: string,
  format: readonly ("esm" | "cjs")[],
  platform: "node" | "neutral",
): string {
  const hasEsm = format.includes("esm");

  if (hasEsm) {
    // ESM wrapper
    const ext = getDistExtension("esm-js", platform);
    return `export * from "./dist/${entryName}${ext}";\nexport { default } from "./dist/${entryName}${ext}";\n`;
  }
  // CJS-only wrapper
  const ext = getDistExtension("cjs-js", platform);
  return `module.exports = require("./dist/${entryName}${ext}");\n`;
}

function generateDtsWrapper(
  entryName: string,
  format: readonly ("esm" | "cjs")[],
  platform: "node" | "neutral",
): string {
  const hasEsm = format.includes("esm");

  if (hasEsm) {
    // ESM types wrapper
    const ext = getDistExtension("esm-dts", platform);
    return `export * from "./dist/${entryName}${ext}";\nexport { default } from "./dist/${entryName}${ext}";\n`;
  }
  // CJS-only types wrapper
  const ext = getDistExtension("cjs-dts", platform);
  return `export * from "./dist/${entryName}${ext}";\nexport { default } from "./dist/${entryName}${ext}";\n`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function generatePackageWrappers(config: TsdownConfig): Promise<string[]> {
  const packageName = config.name;
  const shortName = packageName.replace(/^@soda-gql\//, "");
  const packageDir = join(PACKAGES_DIR, shortName);

  const format = config.format ?? (["esm", "cjs"] as const);
  const platform = config.platform ?? "node";

  // Discover exports from @x-* files (skip @devx-*)
  const discoveredExports = discoverExports(packageDir);

  const generatedFiles: string[] = [];

  for (const [exportKey, { isDev }] of discoveredExports) {
    // Skip dev-only exports
    if (isDev) continue;

    const entryName = exportKeyToEntryName(exportKey);

    // Generate .js wrapper
    const jsPath = join(packageDir, `${entryName}.js`);
    const jsContent = generateJsWrapper(entryName, format, platform);
    await writeFile(jsPath, jsContent);
    generatedFiles.push(`${entryName}.js`);

    // Generate .d.ts wrapper
    const dtsPath = join(packageDir, `${entryName}.d.ts`);
    const dtsContent = generateDtsWrapper(entryName, format, platform);
    await writeFile(dtsPath, dtsContent);
    generatedFiles.push(`${entryName}.d.ts`);
  }

  return generatedFiles;
}

async function updatePackageJsonFiles(
  shortName: string,
  generatedFiles: string[],
): Promise<void> {
  const packageJsonPath = join(PACKAGES_DIR, shortName, "package.json");
  const content = await readFile(packageJsonPath, "utf-8");
  const packageJson: PackageJson = JSON.parse(content);

  // Start with existing files or default to ["dist"]
  const existingFiles = packageJson.files ?? ["dist"];

  // Filter out old wrapper files that we're regenerating
  const wrapperPattern = /^[a-zA-Z_-]+\.(js|d\.ts)$/;
  const filteredFiles = existingFiles.filter((f) => !wrapperPattern.test(f));

  // Add "dist" if not present
  if (!filteredFiles.includes("dist")) {
    filteredFiles.unshift("dist");
  }

  // Add generated files
  const newFiles = [...new Set([...filteredFiles, ...generatedFiles])];

  // Sort: dist first, then alphabetically
  newFiles.sort((a, b) => {
    if (a === "dist") return -1;
    if (b === "dist") return 1;
    return a.localeCompare(b);
  });

  packageJson.files = newFiles;

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
}

async function main() {
  console.log("Generating entry wrapper files...\n");

  const configs = await loadTsdownConfigs();

  for (const config of configs) {
    const shortName = config.name.replace(/^@soda-gql\//, "");
    const packageDir = join(PACKAGES_DIR, shortName);

    // Skip packages without @x-* exports
    if (!hasPublicExports(packageDir)) {
      console.log(`  - ${shortName}: skipped (no @x-* exports)`);
      continue;
    }

    try {
      const generatedFiles = await generatePackageWrappers(config);
      await updatePackageJsonFiles(shortName, generatedFiles);

      const format = config.format ?? ["esm", "cjs"];
      const platform = config.platform ?? "node";
      console.log(
        `  + ${shortName}: ${generatedFiles.length} files (${format.join("+")}, ${platform})`,
      );
    } catch (error) {
      console.error(
        `  x ${shortName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  console.log("\n+ All entry wrappers generated");
}

main();
