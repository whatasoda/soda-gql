/**
 * Utility for working with canonical IDs.
 */

import { resolve } from "node:path";
import { type CanonicalId, createCanonicalId } from "@soda-gql/common";

/**
 * Resolve a canonical ID from a filename and AST path.
 */
export const resolveCanonicalId = (filename: string, astPath: string): CanonicalId =>
  createCanonicalId(resolve(filename), astPath);
