import { readFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");

interface ExportsJson {
  [key: string]: string;
}

export interface TsdownEntry {
  [key: string]: string;
}

export async function loadPackageExports(packageName: string): Promise<TsdownEntry> {
  const exportsJsonPath = join(PACKAGES_DIR, packageName, "exports.json");

  const content = await readFile(exportsJsonPath, "utf-8");
  const exportsJson: ExportsJson = JSON.parse(content);

  const entry: TsdownEntry = {};

  for (const [exportKey, sourcePath] of Object.entries(exportsJson)) {
    // Convert export key to entry key
    // "." -> "index"
    // "./runtime" -> "runtime/index"
    // "./schemas/artifact" -> "schemas/artifact"
    let entryKey: string;
    if (exportKey === ".") {
      entryKey = "index";
    } else {
      entryKey = exportKey.replace(/^\.\//, "");
      // If the source path ends with /index.ts, keep the /index in the entry key
      // Otherwise, the entry key is just the path without leading ./
      if (sourcePath.endsWith("/index.ts")) {
        entryKey = entryKey + "/index";
      }
    }

    entry[entryKey] = join(PACKAGES_DIR, packageName, sourcePath);
  }

  return entry;
}
