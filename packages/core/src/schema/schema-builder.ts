/**
 * Schema definition builders for GraphQL types.
 * @module
 */

import type { EnumDefinition, OperationRoots, ScalarDefinition } from "../types/schema";
import { withTypeMeta } from "../utils/type-meta";
import { wrapByKey } from "../utils/wrap-by-key";

/**
 * Defines a custom scalar type with input/output type mappings.
 *
 * @template TName - The scalar name (e.g., "DateTime", "JSON")
 * @template TInput - TypeScript type for input values
 * @template TOutput - TypeScript type for output values
 *
 * @example
 * ```typescript
 * const scalar = {
 *   ...defineScalar<"DateTime", string, Date>("DateTime"),
 *   ...defineScalar<"JSON", unknown, unknown>("JSON"),
 * };
 * ```
 */
export const defineScalar = <const TName extends string, TInput, TOutput>(name: NoInfer<TName>) =>
  wrapByKey(
    name,
    withTypeMeta({ name }) satisfies ScalarDefinition<{
      name: TName;
      input: TInput;
      output: TOutput;
    }>,
  );

/**
 * Creates an enum type definition for codegen.
 * Uses function overload to declare return type explicitly,
 * reducing structural type comparison cost.
 *
 * @template TName - The enum name
 * @template TValues - Union type of enum values
 * @param name - The enum name (runtime value)
 * @param values - Object with enum values as keys
 * @returns EnumDefinition with proper type metadata
 *
 * @example
 * ```typescript
 * const status = defineEnum<"Status", "ACTIVE" | "INACTIVE">(
 *   "Status",
 *   { ACTIVE: true, INACTIVE: true }
 * );
 * ```
 */
export function defineEnum<TName extends string, TValues extends string>(
  name: TName,
  values: { readonly [_ in TValues]: true },
): EnumDefinition<{ name: TName; values: TValues }>;
export function defineEnum<TName extends string, TValues extends string>(
  name: TName,
  values: { readonly [_ in TValues]: true },
): EnumDefinition<{ name: TName; values: TValues }> {
  return withTypeMeta({ name, values }) as EnumDefinition<{ name: TName; values: TValues }>;
}

/**
 * Defines the root operation types for the schema.
 *
 * @example
 * ```typescript
 * const operations = defineOperationRoots({
 *   query: "Query",
 *   mutation: "Mutation",
 *   subscription: null, // or "Subscription"
 * });
 * ```
 */
export const defineOperationRoots = <const TOperationRoots extends OperationRoots>(operationRoots: TOperationRoots) =>
  operationRoots;
