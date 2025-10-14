/**
 * Cross-runtime glob pattern matching abstraction
 * Provides a unified interface for glob operations across Bun and Node.js
 */

/**
 * Scan files matching a glob pattern from the given directory
 * @param pattern - Glob pattern (e.g., "src/**\/*.ts")
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Array of matched file paths (relative to cwd)
 */
export const scanGlob = (pattern: string, cwd: string = process.cwd()): readonly string[] => {
  // Runtime detection: prefer Bun's native Glob when available
  if (typeof Bun !== "undefined" && Bun.Glob) {
    const { Glob } = Bun;
    const glob = new Glob(pattern);
    return Array.from(glob.scanSync(cwd));
  }

  // Fallback: For now, throw an error to ensure we're running in Bun
  // In the future, this can be replaced with a Node.js implementation using fast-glob
  throw new Error("Glob scanning is only supported in Bun runtime. Please run this code with Bun.");
};
