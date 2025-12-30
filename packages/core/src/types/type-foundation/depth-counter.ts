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

// =============================================================================
// Per-Type Depth Configuration
// =============================================================================

/**
 * Convert a number literal to a depth counter tuple.
 * Supports depths 0-10 (sufficient for most use cases).
 */
export type NumberToDepth<N extends number> = N extends 0
  ? []
  : N extends 1
    ? [unknown]
    : N extends 2
      ? [unknown, unknown]
      : N extends 3
        ? [unknown, unknown, unknown]
        : N extends 4
          ? [unknown, unknown, unknown, unknown]
          : N extends 5
            ? [unknown, unknown, unknown, unknown, unknown]
            : N extends 6
              ? [unknown, unknown, unknown, unknown, unknown, unknown]
              : N extends 7
                ? [unknown, unknown, unknown, unknown, unknown, unknown, unknown]
                : N extends 8
                  ? [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
                  : N extends 9
                    ? [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
                    : N extends 10
                      ? [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
                      : DefaultDepth; // Fallback to default for unsupported numbers

/**
 * Type for per-input-type depth overrides (number-based, as stored in schema).
 */
export type InputDepthOverrides = Readonly<Record<string, number>>;

/**
 * Get depth for a specific input type from schema overrides.
 * Falls back to DefaultDepth if no override exists.
 *
 * @typeParam TOverrides - The input depth overrides from schema
 * @typeParam TTypeName - The input type name to look up
 */
export type GetInputTypeDepth<
  TOverrides extends InputDepthOverrides | undefined,
  TTypeName extends string,
> = TOverrides extends InputDepthOverrides
  ? TTypeName extends keyof TOverrides
    ? NumberToDepth<TOverrides[TTypeName]>
    : DefaultDepth
  : DefaultDepth;
