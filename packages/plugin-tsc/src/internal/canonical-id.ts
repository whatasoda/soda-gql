/**
 * Canonical ID resolution for artifact lookup.
 */

import { resolve } from "node:path";
import { type CanonicalId, createCanonicalId } from "@soda-gql/common";

/**
 * Create a canonical ID from a filename and AST path.
 * Canonical IDs uniquely identify GraphQL definitions across the codebase.
 *
 * @param filename - Source file path
 * @param astPath - AST path within the file (e.g., "default/query")
 * @returns Canonical ID for artifact lookup
 */
export const resolveCanonicalId = (filename: string, astPath: string): CanonicalId =>
  createCanonicalId(resolve(filename), astPath);
