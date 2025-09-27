/**
 * unwrap-nullish utility
 *
 * This utility is a function to safely unwrap values that are nullable in the type system
 * but cannot actually be nullish in the code implementation.
 *
 * Use cases:
 * - When array length is confirmed to be 3 or more, we want to treat arr[2] as string, not string | undefined
 *
 * Important constraints:
 * - Available reasons (fairReasonToStripNullish) are limited to pre-defined ones
 * - Defined in ApprovedFairReasonToStripNullish and subject to regular human review
 * - AI may add entries as needed
 *
 * Usage restrictions:
 * - Use only in the toolchain
 * - Must not be executed in the runtime of applications using soda-gql
 * - NEVER use in core and runtime packages
 */

export class UnwrapNullishError extends Error {
  constructor(fairReasonToStripNullish: string) {
    super(`Value is null or undefined although it was expected to be not null or undefined because: ${fairReasonToStripNullish}`);
    this.name = "UnwrapNullishError";
  }
}

/**
 * Definition of approved reasons for nullish removal
 *
 * When adding a new reason:
 * 1. Set a unique identifier for the key
 * 2. Provide a detailed description of the reason
 * 3. Understand that it will be subject to regular human review
 */
type ApprovedFairReasonToStripNullish =
  | {
      key: "safe-array-item-access";
      description: "array item access to a non-null-item array that is already validated to have item to target index";
    }
  | {
      key: "validated-map-lookup";
      description: "map lookup that has been previously validated to contain the key";
    }
  | {
      key: "guaranteed-by-control-flow";
      description: "value is guaranteed to be non-null by preceding control flow analysis";
    }
  | {
      key: "validated-string-split";
      description: "string split result that is guaranteed to have expected number of parts";
    };

/**
 * Function to safely unwrap nullish values
 *
 * @param value - The value to unwrap (nullable)
 * @param fairReasonToStripNullish - The reason why the value is guaranteed to be non-nullish (specify a key from ApprovedFairReasonToStripNullish)
 * @returns The unwrapped non-null value
 * @throws {UnwrapNullishError} If the value is null or undefined
 *
 * @example
 * ```typescript
 * const arr = ["a", "b", "c"];
 * if (arr.length >= 3) {
 *   const thirdItem = unwrapNullish(arr[2], "safe-array-item-access");
 *   // thirdItem can be treated as string
 * }
 * ```
 */
export const unwrapNullish = <T>(
  value: T | null | undefined,
  fairReasonToStripNullish: ApprovedFairReasonToStripNullish["key"],
): T => {
  if (value === null || value === undefined) {
    throw new UnwrapNullishError(fairReasonToStripNullish);
  }
  return value;
};