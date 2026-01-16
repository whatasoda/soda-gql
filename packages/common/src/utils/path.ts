import { existsSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

/**
 * File extensions to try when resolving module specifiers.
 * Ordered to match TypeScript's module resolution order.
 * @see https://www.typescriptlang.org/docs/handbook/module-resolution.html
 */
export const MODULE_EXTENSION_CANDIDATES = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"] as const;

/**
 * Mapping from JS extensions to their corresponding TS extensions.
 * Used for ESM-style imports where .js is written but .ts is the actual source.
 */
const JS_TO_TS_EXTENSION_MAP: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
  ".jsx": [".tsx"],
};

/**
 * Result of parsing a JS extension from a specifier.
 */
export type JsExtensionInfo = {
  /** The specifier without the JS extension */
  readonly base: string;
  /** The JS extension found (e.g., ".js", ".mjs") */
  readonly jsExtension: string;
  /** The corresponding TS extensions to try (e.g., [".ts", ".tsx"] for ".js") */
  readonly tsExtensions: readonly string[];
};

/**
 * Parse a JS extension from a specifier for ESM-style import resolution.
 * Returns the base path (without extension), the JS extension, and corresponding TS extensions.
 *
 * @param specifier - The import specifier to parse
 * @returns Object with base, jsExtension, and tsExtensions, or null if no JS extension found
 *
 * @example
 * parseJsExtension("./foo.js") // { base: "./foo", jsExtension: ".js", tsExtensions: [".ts", ".tsx"] }
 * parseJsExtension("./foo.mjs") // { base: "./foo", jsExtension: ".mjs", tsExtensions: [".mts"] }
 * parseJsExtension("./foo") // null
 * parseJsExtension("./foo.ts") // null
 */
export const parseJsExtension = (specifier: string): JsExtensionInfo | null => {
  for (const [ext, tsExts] of Object.entries(JS_TO_TS_EXTENSION_MAP)) {
    if (specifier.endsWith(ext)) {
      return {
        base: specifier.slice(0, -ext.length),
        jsExtension: ext,
        tsExtensions: tsExts,
      };
    }
  }
  return null;
};

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
  // Handle ESM-style imports with JS extensions (e.g., "./foo.js" -> "./foo.ts")
  const jsExtInfo = parseJsExtension(specifier);
  if (jsExtInfo) {
    const baseWithoutExt = resolve(dirname(filePath), jsExtInfo.base);

    // Try corresponding TS extensions first
    for (const ext of jsExtInfo.tsExtensions) {
      const candidate = `${baseWithoutExt}${ext}`;
      if (existsSync(candidate)) {
        return normalizePath(candidate);
      }
    }

    // Fall back to actual JS file if it exists
    const jsCandidate = `${baseWithoutExt}${jsExtInfo.jsExtension}`;
    if (existsSync(jsCandidate)) {
      try {
        const stat = statSync(jsCandidate);
        if (stat.isFile()) {
          return normalizePath(jsCandidate);
        }
      } catch {
        // Ignore stat errors
      }
    }

    return null;
  }

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
  // Handle ESM-style imports with JS extensions (e.g., "./foo.js" -> "./foo.ts")
  const jsExtInfo = parseJsExtension(specifier);
  if (jsExtInfo) {
    const baseWithoutExt = resolve(dirname(filePath), jsExtInfo.base);

    // Try corresponding TS extensions first
    for (const ext of jsExtInfo.tsExtensions) {
      const candidate = `${baseWithoutExt}${ext}`;
      if (references.has(candidate)) {
        return normalizePath(candidate);
      }
    }

    // Fall back to actual JS file if it exists in references
    const jsCandidate = `${baseWithoutExt}${jsExtInfo.jsExtension}`;
    if (references.has(jsCandidate)) {
      return normalizePath(jsCandidate);
    }

    return null;
  }

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
