/**
 * Utility functions for plugin-babel.
 * Re-exports from @soda-gql/plugin-common.
 */

export { resolveCanonicalId } from "@soda-gql/plugin-common";

/**
 * Wrap an adapter-specific expression handle into a runtime expression.
 */
export const makeRuntimeExpression = (handle: unknown): { kind: "adapter-expression"; handle: unknown } => ({
  kind: "adapter-expression",
  handle,
});
