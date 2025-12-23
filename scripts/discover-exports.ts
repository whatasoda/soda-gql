import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface ExportEntry {
  /** Relative path from package root (e.g., "./@x-runtime.ts") */
  sourcePath: string;
  /** Whether this is a dev-only export (@devx-*) */
  isDev: boolean;
}

/**
 * Discover exports from @x-* and @devx-* files/directories in a package.
 *
 * File naming convention:
 * - @x-index.ts → "." (root export)
 * - @x-{name}.ts → "./{name}"
 * - @x-{name}/index.ts → "./{name}"
 * - @x-{name}/{file}.ts → "./{name}/{file}"
 * - @devx-* follows the same pattern but produces dev-only exports
 *
 * @param packageDir Absolute path to the package directory
 * @returns Map of export key to ExportEntry
 */
export function discoverExports(packageDir: string): Map<string, ExportEntry> {
  const exports = new Map<string, ExportEntry>();
  const entries = readdirSync(packageDir, { withFileTypes: true });

  for (const entry of entries) {
    // Match @x-*.ts or @devx-*.ts files
    const fileMatch = entry.name.match(/^@(devx|x)-(.+)\.ts$/);
    // Match @x-* or @devx-* directories
    const dirMatch = entry.name.match(/^@(devx|x)-(.+)$/);

    if (entry.isFile() && fileMatch) {
      const [, prefix, name] = fileMatch;
      const isDev = prefix === "devx";
      const exportKey = name === "index" ? "." : `./${name}`;
      exports.set(exportKey, {
        sourcePath: `./${entry.name}`,
        isDev,
      });
    } else if (entry.isDirectory() && dirMatch) {
      const [, prefix, baseName] = dirMatch;
      const isDev = prefix === "devx";
      const dirPath = join(packageDir, entry.name);

      // Scan directory for nested exports
      const dirEntries = readdirSync(dirPath, { withFileTypes: true });
      for (const dirEntry of dirEntries) {
        if (dirEntry.isFile() && dirEntry.name.endsWith(".ts")) {
          const fileName = dirEntry.name.replace(/\.ts$/, "");
          const exportKey = fileName === "index" ? `./${baseName}` : `./${baseName}/${fileName}`;
          exports.set(exportKey, {
            sourcePath: `./${entry.name}/${dirEntry.name}`,
            isDev,
          });
        }
      }
    }
  }

  return exports;
}

/**
 * Check if a package has any @x-* exports (public exports that need building).
 */
export function hasPublicExports(packageDir: string): boolean {
  const entries = readdirSync(packageDir, { withFileTypes: true });
  return entries.some((e) => e.name.startsWith("@x-"));
}
