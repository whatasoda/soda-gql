/**
 * Glob pattern matching using fast-glob
 */

import fg from "fast-glob";

/**
 * Scan files matching glob patterns from the given directory.
 * Supports negation patterns (e.g., "!**\/excluded.ts").
 *
 * @param patterns - Glob pattern(s). Can be a single pattern or array of patterns.
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Array of matched file paths (relative to cwd)
 */
export const scanGlob = (patterns: string | readonly string[], cwd: string = process.cwd()): readonly string[] => {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  return fg.sync(patternArray as string[], { cwd, dot: true, onlyFiles: true });
};
