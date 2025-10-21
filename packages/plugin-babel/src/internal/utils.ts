/**
 * Utility functions for plugin-babel.
 * Simplified from plugin-shared to be self-contained.
 */

import { resolve } from "node:path";
import { type CanonicalId, createCanonicalId } from "@soda-gql/builder";

/**
 * Resolve a canonical ID from a filename and AST path.
 */
export const resolveCanonicalId = (filename: string, astPath: string): CanonicalId =>
  createCanonicalId(resolve(filename), astPath);

/**
 * Wrap an adapter-specific expression handle into a runtime expression.
 */
export const makeRuntimeExpression = (handle: unknown): { kind: "adapter-expression"; handle: unknown } => ({
  kind: "adapter-expression",
  handle,
});
