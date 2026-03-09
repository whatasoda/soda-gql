/**
 * Package discovery utilities for doctor command.
 * @module
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { DiscoveredPackage } from "./types";

const SODA_GQL_SCOPE = "@soda-gql";

/**
 * Find the nearest node_modules directory.
 */
export const findNodeModules = (startDir: string = process.cwd()): string | null => {
  let currentDir = startDir;
  while (currentDir !== dirname(currentDir)) {
    const nodeModulesPath = join(currentDir, "node_modules");
    if (existsSync(nodeModulesPath) && statSync(nodeModulesPath).isDirectory()) {
      return nodeModulesPath;
    }
    currentDir = dirname(currentDir);
  }
  return null;
};

/**
 * Read package.json from a directory.
 */
const readPackageJson = (dir: string): Result<{ name: string; version: string }, string> => {
  const packageJsonPath = join(dir, "package.json");
  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as { name?: string; version?: string };
    if (!pkg.name || !pkg.version) {
      return err(`Invalid package.json at ${packageJsonPath}`);
    }
    return ok({ name: pkg.name, version: pkg.version });
  } catch {
    return err(`Failed to read package.json at ${packageJsonPath}`);
  }
};

/**
 * Discover @soda-gql packages at a specific node_modules path.
 */
const discoverAtPath = (nodeModulesPath: string): DiscoveredPackage[] => {
  const scopePath = join(nodeModulesPath, SODA_GQL_SCOPE);
  if (!existsSync(scopePath)) {
    return [];
  }

  const packages: DiscoveredPackage[] = [];

  try {
    const entries = readdirSync(scopePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const packageDir = join(scopePath, entry.name);
      const result = readPackageJson(packageDir);

      if (result.isOk()) {
        packages.push({
          name: result.value.name,
          version: result.value.version,
          path: packageDir,
        });
      }
    }
  } catch {
    // Ignore read errors
  }

  return packages;
};

/**
 * Discover all @soda-gql packages including nested node_modules.
 * Uses breadth-first search to avoid deep recursion.
 */
export const discoverAllSodaGqlPackages = (startDir: string = process.cwd()): Result<DiscoveredPackage[], string> => {
  const rootNodeModules = findNodeModules(startDir);
  if (!rootNodeModules) {
    return err("No node_modules directory found");
  }

  const allPackages: DiscoveredPackage[] = [];
  const visitedPaths = new Set<string>();
  const queue: string[] = [rootNodeModules];

  while (queue.length > 0) {
    const nodeModulesPath = queue.shift();
    if (!nodeModulesPath) continue;

    // Resolve to handle symlinks
    let realPath: string;
    try {
      realPath = resolve(nodeModulesPath);
    } catch {
      continue;
    }

    if (visitedPaths.has(realPath)) continue;
    visitedPaths.add(realPath);

    // Discover packages at this level
    const packages = discoverAtPath(nodeModulesPath);
    allPackages.push(...packages);

    // Look for nested node_modules
    try {
      const entries = readdirSync(nodeModulesPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Check scoped packages
        if (entry.name.startsWith("@")) {
          const scopeDir = join(nodeModulesPath, entry.name);
          try {
            const scopeEntries = readdirSync(scopeDir, { withFileTypes: true });

            for (const scopeEntry of scopeEntries) {
              if (!scopeEntry.isDirectory()) continue;
              const nestedNodeModules = join(scopeDir, scopeEntry.name, "node_modules");
              if (existsSync(nestedNodeModules)) {
                queue.push(nestedNodeModules);
              }
            }
          } catch {
            // Ignore read errors
          }
        } else {
          // Check regular packages
          const nestedNodeModules = join(nodeModulesPath, entry.name, "node_modules");
          if (existsSync(nestedNodeModules)) {
            queue.push(nestedNodeModules);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return ok(allPackages);
};

/**
 * Get the soda-gql CLI version.
 */
export const getCliVersion = (): string => {
  try {
    // Navigate from this file (commands/doctor/discovery.ts) to package.json
    // Path: discovery.ts -> doctor/ -> commands/ -> src/ -> cli/package.json
    const cliPackageJsonPath = join(import.meta.dirname, "..", "..", "..", "package.json");
    const content = readFileSync(cliPackageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
};

/**
 * Get TypeScript version from node_modules.
 */
export const getTypescriptVersion = (startDir: string = process.cwd()): string | null => {
  const nodeModulesPath = findNodeModules(startDir);
  if (!nodeModulesPath) return null;

  const tsPackageJson = join(nodeModulesPath, "typescript", "package.json");
  try {
    const content = readFileSync(tsPackageJson, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
};
