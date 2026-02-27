import { existsSync } from "node:fs";
import { normalize, resolve } from "node:path";
import { err, ok } from "neverthrow";

import picomatch from "picomatch";

import type { BuilderError } from "../types";
import { scanGlob } from "../utils/glob";

/**
 * Resolve entry file paths from glob patterns or direct paths.
 * Used by the discovery system to find entry points for module traversal.
 * All paths are normalized to POSIX format for consistent cache key matching.
 * Uses Node.js normalize() + backslash replacement to match normalizePath from @soda-gql/common.
 *
 * @param entries - Include patterns (glob or direct paths). Supports negation patterns (e.g., "!./path/to/exclude.ts")
 * @param exclude - Exclude patterns from config.exclude. Converted to negation globs for filtering.
 */
export const resolveEntryPaths = (entries: readonly string[], exclude: readonly string[] = []) => {
  // Separate direct file paths from glob patterns
  const directPaths: string[] = [];
  const globPatterns: string[] = [];

  for (const entry of entries) {
    // Negation patterns are always glob patterns
    if (entry.startsWith("!")) {
      globPatterns.push(entry);
      continue;
    }

    const absolute = resolve(entry);
    if (existsSync(absolute)) {
      // Normalize to POSIX format to match discovery cache keys
      directPaths.push(normalize(absolute).replace(/\\/g, "/"));
    } else {
      // Treat as glob pattern
      globPatterns.push(entry);
    }
  }

  // Filter direct paths against exclude patterns (both literal and glob)
  if (exclude.length > 0 && directPaths.length > 0) {
    const excludePatterns = exclude.map((p) => {
      const raw = p.startsWith("!") ? p.slice(1) : p;
      return normalize(resolve(raw)).replace(/\\/g, "/");
    });
    const isExcluded = picomatch(excludePatterns);
    const filtered = directPaths.filter((p) => !isExcluded(p));
    directPaths.length = 0;
    directPaths.push(...filtered);
  }

  // Append exclude patterns as negation globs
  for (const pattern of exclude) {
    globPatterns.push(pattern.startsWith("!") ? pattern : `!${pattern}`);
  }

  // Scan all glob patterns together (important for negation patterns to work)
  const globMatches =
    globPatterns.length > 0
      ? scanGlob(globPatterns, process.cwd()).map((match) => {
          // Normalize to POSIX format to match discovery cache keys
          return normalize(resolve(match)).replace(/\\/g, "/");
        })
      : [];

  const resolvedPaths = [...directPaths, ...globMatches];

  if (resolvedPaths.length === 0) {
    return err<readonly string[], BuilderError>({
      code: "ENTRY_NOT_FOUND",
      message: `No entry files matched ${entries.join(", ")}`,
      entry: entries.join(", "),
    });
  }

  return ok<readonly string[], BuilderError>(resolvedPaths);
};
