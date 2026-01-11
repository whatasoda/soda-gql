/**
 * Cross-runtime glob pattern matching abstraction
 * Provides a unified interface for glob operations across Bun and Node.js
 */

import fg from "fast-glob";

/**
 * Scan files matching glob patterns from the given directory.
 * Supports negation patterns (e.g., "!**\/excluded.ts") when using fast-glob.
 *
 * @param patterns - Glob pattern(s). Can be a single pattern or array of patterns.
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Array of matched file paths (relative to cwd)
 */
export const scanGlob = (patterns: string | readonly string[], cwd: string = process.cwd()): readonly string[] => {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  const hasNegation = patternArray.some((p) => p.startsWith("!"));

  // Runtime detection: prefer Bun's native Glob when available for better performance
  // However, Bun.Glob doesn't support negation patterns, so fall back to fast-glob
  if (typeof Bun !== "undefined" && Bun.Glob && !hasNegation) {
    const { Glob } = Bun;
    // Bun.Glob only accepts single pattern, so we need to merge results
    const results = new Set<string>();
    for (const pattern of patternArray) {
      const glob = new Glob(pattern);
      for (const match of glob.scanSync(cwd)) {
        results.add(match);
      }
    }
    return Array.from(results);
  }

  // Node.js fallback or negation patterns: use fast-glob for cross-platform compatibility
  return fg.sync(patternArray as string[], { cwd, dot: true, onlyFiles: true });
};
