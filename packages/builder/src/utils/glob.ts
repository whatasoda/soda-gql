/**
 * Cross-runtime glob pattern matching abstraction
 * Provides a unified interface for glob operations across Bun and Node.js
 */

import fg from "fast-glob";

/**
 * Scan files matching a glob pattern from the given directory
 * @param pattern - Glob pattern (e.g., "src/**\/*.ts")
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Array of matched file paths (relative to cwd)
 */
export const scanGlob = (pattern: string, cwd: string = process.cwd()): readonly string[] => {
  // Runtime detection: prefer Bun's native Glob when available for better performance
  if (typeof Bun !== "undefined" && Bun.Glob) {
    const { Glob } = Bun;
    const glob = new Glob(pattern);
    return Array.from(glob.scanSync(cwd));
  }

  // Node.js fallback: use fast-glob for cross-platform compatibility
  return fg.sync(pattern, { cwd, dot: true, onlyFiles: true });
};
