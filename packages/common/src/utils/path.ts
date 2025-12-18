import { existsSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

/**
 * File extensions to try when resolving module specifiers.
 * Ordered by precedence: TypeScript, then JavaScript.
 */
export const MODULE_EXTENSION_CANDIDATES = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"] as const;

/**
 * Normalize path to use forward slashes (cross-platform).
 * Ensures consistent path handling across platforms.
 */
export const normalizePath = (value: string): string => normalize(value).replace(/\\/g, "/");

/**
 * Resolve a relative import specifier to an absolute file path.
 * Tries the specifier as-is, with extensions, and as a directory with index files.
 *
 * @param from - Absolute path to the importing file
 * @param specifier - Relative module specifier (must start with '.')
 * @returns Absolute POSIX path to the resolved file, or null if not found
 */
export const resolveRelativeImportWithExistenceCheck = ({
  filePath,
  specifier,
}: {
  filePath: string;
  specifier: string;
}): string | null => {
  const base = resolve(dirname(filePath), specifier);

  // Try with extensions first (most common case)
  // This handles cases like "./constants" resolving to "./constants.ts"
  // even when a "./constants" directory exists
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) {
      return normalizePath(candidate);
    }
  }

  // Try as directory with index files
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) {
      return normalizePath(candidate);
    }
  }

  // Try exact path last (only if it's a file, not directory)
  if (existsSync(base)) {
    try {
      const stat = statSync(base);
      if (stat.isFile()) {
        return normalizePath(base);
      }
    } catch {
      // Ignore stat errors
    }
  }

  return null;
};

/**
 * Resolve a relative import specifier to an absolute file path.
 * Tries the specifier as-is, with extensions, and as a directory with index files.
 *
 * @param from - Absolute path to the importing file
 * @param specifier - Relative module specifier (must start with '.')
 * @returns Absolute POSIX path to the resolved file, or null if not found
 */
export const resolveRelativeImportWithReferences = <_>({
  filePath,
  specifier,
  references,
}: {
  filePath: string;
  specifier: string;
  references: Map<string, _> | Set<string>;
}): string | null => {
  const base = resolve(dirname(filePath), specifier);

  // Try exact path first
  if (references.has(base)) {
    return normalizePath(base);
  }

  // Try with extensions
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = `${base}${ext}`;
    if (references.has(candidate)) {
      return normalizePath(candidate);
    }
  }

  // Try as directory with index files
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = join(base, `index${ext}`);
    if (references.has(candidate)) {
      return normalizePath(candidate);
    }
  }

  return null;
};

/**
 * Check if a module specifier is relative (starts with '.' or '..')
 */
export const isRelativeSpecifier = (specifier: string): boolean => specifier.startsWith("./") || specifier.startsWith("../");

/**
 * Check if a module specifier is external (package name, not relative)
 */
export const isExternalSpecifier = (specifier: string): boolean => !isRelativeSpecifier(specifier);
