/**
 * Depth counter utilities for limiting type inference recursion.
 *
 * Used primarily to prevent infinite recursion in recursive input types
 * like Hasura's `bool_exp` pattern where types reference themselves.
 */

/**
 * A depth counter represented as a tuple.
 * The length of the tuple represents the remaining depth.
 */
export type DepthCounter = readonly unknown[];

/**
 * Default depth limit for input type inference.
 * Depth 3 allows:
 * - Level 0: Top-level fields
 * - Level 1: First-level nested objects
 * - Level 2: Second-level nested objects
 * - Level 3: Third-level nested objects (then stops)
 */
export type DefaultDepth = [unknown, unknown, unknown];

/**
 * Decrement depth by removing one element from the tuple.
 * Returns empty tuple when depth is already exhausted.
 */
export type DecrementDepth<D extends DepthCounter> = D extends readonly [unknown, ...infer Rest] ? Rest : [];

/**
 * Check if depth counter is exhausted (empty tuple).
 */
export type IsDepthExhausted<D extends DepthCounter> = D extends readonly [] ? true : false;
