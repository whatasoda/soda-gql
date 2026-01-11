import { existsSync } from "node:fs";
import { normalize, resolve } from "node:path";
import { err, ok } from "neverthrow";
import picomatch from "picomatch";

import type { BuilderError } from "../types";
import { scanGlob } from "../utils/glob";

const scanEntries = (pattern: string): readonly string[] => {
  return scanGlob(pattern, process.cwd());
};

/**
 * Resolve entry file paths from glob patterns or direct paths.
 * Used by the discovery system to find entry points for module traversal.
 * All paths are normalized to POSIX format for consistent cache key matching.
 * Uses Node.js normalize() + backslash replacement to match normalizePath from @soda-gql/common.
 *
 * @param entries - Include patterns (glob or direct paths)
 * @param excludePatterns - Optional patterns to exclude from results
 */
export const resolveEntryPaths = (entries: readonly string[], excludePatterns?: readonly string[]) => {
  const resolvedPaths = entries.flatMap((entry) => {
    const absolute = resolve(entry);
    if (existsSync(absolute)) {
      // Normalize to POSIX format to match discovery cache keys (normalize() + replace backslashes)
      return [normalize(absolute).replace(/\\/g, "/")];
    }

    const matches = scanEntries(entry).map((match) => {
      // Normalize to POSIX format to match discovery cache keys (normalize() + replace backslashes)
      return normalize(resolve(match)).replace(/\\/g, "/");
    });
    return matches;
  });

  // Filter out paths matching exclude patterns
  const filteredPaths = excludePatterns?.length
    ? resolvedPaths.filter((path) => {
        const isExcluded = excludePatterns.some((pattern) => picomatch.isMatch(path, pattern, { dot: true }));
        return !isExcluded;
      })
    : resolvedPaths;

  if (filteredPaths.length === 0) {
    return err<readonly string[], BuilderError>({
      code: "ENTRY_NOT_FOUND",
      message: `No entry files matched ${entries.join(", ")}`,
      entry: entries.join(", "),
    });
  }

  return ok<readonly string[], BuilderError>(filteredPaths);
};
