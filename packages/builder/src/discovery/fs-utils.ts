import { existsSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

/**
 * Normalize a path to use POSIX separators (forward slashes).
 * Ensures consistent path handling across platforms.
 */
export const normalizeToPosix = (value: string): string => normalize(value).replace(/\\/g, "/");

/**
 * File extensions to try when resolving module specifiers.
 * Ordered by precedence: TypeScript, then JavaScript.
 */
export const MODULE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"] as const;

/**
 * Resolve a relative import specifier to an absolute file path.
 * Tries the specifier as-is, with extensions, and as a directory with index files.
 *
 * @param from - Absolute path to the importing file
 * @param specifier - Relative module specifier (must start with '.')
 * @returns Absolute POSIX path to the resolved file, or null if not found
 */
export const resolveRelativeImport = (from: string, specifier: string): string | null => {
  const base = resolve(dirname(from), specifier);

  // Try exact path first
  if (existsSync(base)) {
    return normalizeToPosix(base);
  }

  // Try with extensions
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) {
      return normalizeToPosix(candidate);
    }
  }

  // Try as directory with index files
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) {
      return normalizeToPosix(candidate);
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
