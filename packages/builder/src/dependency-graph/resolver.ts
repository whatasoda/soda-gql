/**
 * Module resolution utilities for dependency graph and runtime imports.
 * Provides both in-memory Map-based resolution (fast path for graph building)
 * and filesystem-aware resolution (fallback for runtime imports).
 */

import { dirname, join, normalize, resolve } from "node:path";
import { getPortableFS } from "@soda-gql/common/portable";
import type { ModuleAnalysis } from "../ast";

/**
 * File extensions to try when resolving module specifiers.
 * Ordered by precedence: TypeScript, then JavaScript.
 */
export const MODULE_EXTENSION_CANDIDATES = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
] as const;

export type ModuleExtension = (typeof MODULE_EXTENSION_CANDIDATES)[number];

/**
 * Normalize path to use forward slashes (cross-platform).
 * Ensures consistent path handling across platforms.
 */
export const normalizePath = (value: string): string => normalize(value).replace(/\\/g, "/");

/**
 * Resolve a module specifier using an in-memory module lookup.
 * This is the fast path used during dependency graph building.
 *
 * @param filePath - Absolute path to the importing file
 * @param specifier - Module specifier (e.g., './component', '../utils')
 * @param analyses - Map of normalized file paths to ModuleAnalysis
 * @returns ModuleAnalysis if found, null otherwise
 */
export const resolveModuleSpecifier = ({
  filePath,
  specifier,
  analyses,
}: {
  filePath: string;
  specifier: string;
  analyses: ReadonlyMap<string, ModuleAnalysis>;
}): ModuleAnalysis | null => {
  // Skip external imports (node_modules, bare specifiers)
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = normalizePath(resolve(dirname(filePath), specifier));

  // Try all extension candidates
  const candidates = [
    base, // Already has extension
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    join(base, "index.js"),
    join(base, "index.jsx"),
  ];

  for (const candidate of candidates) {
    const module = analyses.get(normalizePath(candidate));
    if (module) {
      return module;
    }
  }

  return null;
};

/**
 * Resolve a module specifier to an absolute file path using filesystem checks.
 * This is the fallback path used for runtime imports when the module might not
 * be in the in-memory graph yet.
 *
 * @param from - Absolute path to the importing file
 * @param specifier - Module specifier (e.g., './component', '../utils')
 * @returns Promise resolving to absolute normalized path, or null if not found
 */
export async function resolveModuleSpecifierFS(from: string, specifier: string): Promise<string | null> {
  // Skip external imports (node_modules, bare specifiers)
  if (!specifier.startsWith(".")) {
    return null;
  }

  const fs = getPortableFS();
  const baseDir = dirname(from);
  const resolved = resolve(baseDir, specifier);

  // If specifier already has an extension, check it first
  const ext = specifier.match(/\.(tsx?|jsx?|mjs|cjs)$/)?.[0];
  if (ext) {
    if (await fs.exists(resolved)) {
      return normalizePath(resolved);
    }
    // Explicit extension doesn't exist - return null (hard error)
    return null;
  }

  // Try all extension candidates in order
  for (const candidate of MODULE_EXTENSION_CANDIDATES) {
    const candidatePath = candidate.startsWith("/")
      ? join(resolved, candidate.substring(1)) // Remove leading '/' for join
      : `${resolved}${candidate}`;

    if (await fs.exists(candidatePath)) {
      return normalizePath(candidatePath);
    }
  }

  // Could not resolve
  return null;
}

/**
 * Resolve a module specifier with Map-first, filesystem-fallback strategy.
 * Tries in-memory lookup first for performance, falls back to FS if needed.
 *
 * This is the recommended entry point for runtime import resolution in builder session.
 *
 * @param from - Absolute path to the importing file
 * @param specifier - Module specifier
 * @param candidates - Optional in-memory module lookup
 * @returns Promise resolving to absolute normalized path, or null if not found
 */
export async function resolveModuleHybrid(
  from: string,
  specifier: string,
  candidates?: ReadonlyMap<string, ModuleAnalysis>,
): Promise<string | null> {
  // Try Map-based lookup first if available
  if (candidates) {
    const module = resolveModuleSpecifier({ filePath: from, specifier, analyses: candidates });
    if (module) {
      return normalizePath(module.filePath);
    }
  }

  // Fall back to filesystem resolution
  return resolveModuleSpecifierFS(from, specifier);
}
