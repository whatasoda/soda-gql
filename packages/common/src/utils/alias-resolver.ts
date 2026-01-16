import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { MODULE_EXTENSION_CANDIDATES, normalizePath, parseJsExtension } from "./path";
import type { TsconfigPathsConfig } from "./tsconfig";

/**
 * Alias resolver interface for resolving path aliases to file paths.
 */
export type AliasResolver = {
  /**
   * Resolve an alias specifier to an absolute file path.
   * Returns null if the specifier doesn't match any alias pattern
   * or if the resolved file doesn't exist.
   */
  readonly resolve: (specifier: string) => string | null;
};

/**
 * Match a specifier against a tsconfig path pattern.
 * Returns the captured wildcard portion or null if no match.
 *
 * Pattern rules:
 * - Exact match: "@/utils" matches "@/utils" exactly, captures ""
 * - Wildcard: "@/*" matches "@/foo", captures "foo"
 * - Wildcard with suffix: "*.js" matches "foo.js", captures "foo"
 */
const matchPattern = (specifier: string, pattern: string): string | null => {
  const starIndex = pattern.indexOf("*");

  if (starIndex === -1) {
    // Exact match - no wildcard
    return specifier === pattern ? "" : null;
  }

  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);

  if (!specifier.startsWith(prefix)) {
    return null;
  }

  if (suffix && !specifier.endsWith(suffix)) {
    return null;
  }

  // Extract the wildcard capture
  const captured = specifier.slice(prefix.length, suffix ? specifier.length - suffix.length : undefined);

  return captured;
};

/**
 * Apply a captured wildcard to a target path.
 */
const applyCapture = (target: string, captured: string): string => {
  const starIndex = target.indexOf("*");
  if (starIndex === -1) {
    return target;
  }
  return target.slice(0, starIndex) + captured + target.slice(starIndex + 1);
};

/**
 * Try to resolve a path to an actual file, applying extension resolution.
 * Handles ESM-style imports with JS extensions.
 */
const resolveToFile = (basePath: string): string | null => {
  // Handle ESM-style JS extension imports
  const jsExtInfo = parseJsExtension(basePath);
  if (jsExtInfo) {
    const baseWithoutExt = basePath.slice(0, -jsExtInfo.jsExtension.length);

    // Try corresponding TS extensions first
    for (const ext of jsExtInfo.tsExtensions) {
      const candidate = `${baseWithoutExt}${ext}`;
      if (existsSync(candidate)) {
        try {
          const stat = statSync(candidate);
          if (stat.isFile()) {
            return normalizePath(candidate);
          }
        } catch {
          // Ignore stat errors
        }
      }
    }

    // Fall back to actual JS file
    if (existsSync(basePath)) {
      try {
        const stat = statSync(basePath);
        if (stat.isFile()) {
          return normalizePath(basePath);
        }
      } catch {
        // Ignore stat errors
      }
    }

    return null;
  }

  // Try exact path first (for paths with explicit extension)
  if (existsSync(basePath)) {
    try {
      const stat = statSync(basePath);
      if (stat.isFile()) {
        return normalizePath(basePath);
      }
    } catch {
      // Ignore stat errors
    }
  }

  // Try with extensions
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = `${basePath}${ext}`;
    if (existsSync(candidate)) {
      try {
        const stat = statSync(candidate);
        if (stat.isFile()) {
          return normalizePath(candidate);
        }
      } catch {
        // Ignore stat errors
      }
    }
  }

  // Try as directory with index files
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = join(basePath, `index${ext}`);
    if (existsSync(candidate)) {
      try {
        const stat = statSync(candidate);
        if (stat.isFile()) {
          return normalizePath(candidate);
        }
      } catch {
        // Ignore stat errors
      }
    }
  }

  return null;
};

/**
 * Create an alias resolver from tsconfig paths configuration.
 *
 * Resolution behavior:
 * 1. Try each pattern in order (first match wins per TS spec)
 * 2. For each matched pattern, try all target paths in order
 * 3. For each target, apply extension resolution
 * 4. Return first found file, or null if none found
 */
export const createAliasResolver = (config: TsconfigPathsConfig): AliasResolver => {
  const { paths } = config;
  const patterns = Object.keys(paths);

  return {
    resolve: (specifier: string): string | null => {
      // Try each pattern in order (first match wins per TS spec)
      for (const pattern of patterns) {
        const captured = matchPattern(specifier, pattern);
        if (captured === null) {
          continue;
        }

        const targets = paths[pattern];
        if (!targets) {
          continue;
        }

        // Try each target path in order
        for (const target of targets) {
          const resolvedTarget = applyCapture(target, captured);
          const result = resolveToFile(resolvedTarget);
          if (result) {
            return result;
          }
        }
      }

      return null;
    },
  };
};
