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
// Future Extensibility: Per-Type Depth Configuration
// =============================================================================

/**
 * Type for per-input-type depth overrides.
 *
 * @example
 * ```typescript
 * // Future usage (not yet implemented):
 * type MyDepthOverrides = {
 *   user_bool_exp: [unknown, unknown, unknown, unknown, unknown]; // depth 5
 *   post_bool_exp: [unknown, unknown]; // depth 2
 * };
 * ```
 *
 * @remarks
 * This type is a placeholder for future per-type depth configuration.
 * Currently, all input types use the same default depth (3).
 */
export type TypeDepthOverrides = {
  readonly [typeName: string]: DepthCounter;
};

/**
 * Get depth for a specific type name from overrides, falling back to default.
 *
 * @typeParam TTypeName - The input type name to look up
 * @typeParam TOverrides - The depth overrides map
 * @typeParam TDefault - The default depth to use if no override exists
 *
 * @example
 * ```typescript
 * // Future usage (not yet implemented):
 * type Depth = GetDepthForType<"user_bool_exp", MyDepthOverrides, DefaultDepth>;
 * ```
 *
 * @remarks
 * This type is a placeholder for future per-type depth configuration.
 * It will be used when depth overrides are configurable via schema or config.
 */
export type GetDepthForType<
  TTypeName extends string,
  TOverrides extends TypeDepthOverrides,
  TDefault extends DepthCounter,
> = TTypeName extends keyof TOverrides ? TOverrides[TTypeName] : TDefault;
