/**
 * Utility for working with canonical IDs.
 */

import { resolve } from "node:path";
import { type CanonicalId, createCanonicalId } from "@soda-gql/common";

/**
 * Options for resolving a canonical ID.
 */
export type ResolveCanonicalIdOptions = {
  /**
   * Base directory for relative path computation.
   * When provided, the canonical ID will use a path relative to this directory.
   */
  readonly baseDir?: string;
};

/**
 * Resolve a canonical ID from a filename and AST path.
 *
 * @param filename - The source file path (absolute or relative)
 * @param astPath - The AST path within the file
 * @param options - Optional settings including baseDir for relative paths
 * @returns A canonical ID in the format `{path}::{astPath}`
 */
export const resolveCanonicalId = (
  filename: string,
  astPath: string,
  options?: ResolveCanonicalIdOptions,
): CanonicalId => {
  const { baseDir } = options ?? {};
  if (baseDir) {
    return createCanonicalId(filename, astPath, { baseDir });
  }
  return createCanonicalId(resolve(filename), astPath);
};
