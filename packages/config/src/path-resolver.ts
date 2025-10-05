import { isAbsolute, relative, resolve } from "node:path";
import type { ResolvedSodaGqlConfig } from "./types";

/**
 * Map source extensions to emit extensions.
 * ESM requires explicit extensions in import specifiers.
 */
const EXTENSION_MAP: Record<string, string> = {
  ".ts": ".js",
  ".tsx": ".js",
  ".mts": ".mjs",
  ".cts": ".cjs",
};

/**
 * Resolve import path with proper ESM module specifier.
 * Does NOT strip extensions - maps .ts to .js for emitted files.
 */
export function resolveImportPath(
  fromDir: string,
  toPath: string,
  emitted: boolean = true, // Whether target is emitted JS or source TS
): string {
  // If toPath is not an absolute path (e.g., package name like "@soda-gql/core")
  // return it as-is
  if (!isAbsolute(toPath) && !toPath.startsWith(".")) {
    return toPath;
  }

  const absoluteTo = isAbsolute(toPath) ? toPath : resolve(fromDir, toPath);

  let relativePath = relative(fromDir, absoluteTo).replace(/\\/g, "/");

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  // Map extensions if target is emitted
  if (emitted) {
    for (const [srcExt, emitExt] of Object.entries(EXTENSION_MAP)) {
      if (relativePath.endsWith(srcExt)) {
        return relativePath.slice(0, -srcExt.length) + emitExt;
      }
    }
  }

  return relativePath;
}

/**
 * Get gql import path from resolved config.
 */
export function getGqlImportPath(config: ResolvedSodaGqlConfig): string {
  return resolveImportPath(
    config.builder.outDir,
    config.graphqlSystemPath,
    true, // Emitted JS
  );
}

/**
 * Get @soda-gql/core import path from resolved config.
 */
export function getCoreImportPath(config: ResolvedSodaGqlConfig): string {
  return resolveImportPath(
    config.builder.outDir,
    config.corePath,
    false, // Source - package exports handle this
  );
}
