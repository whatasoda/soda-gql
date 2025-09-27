/**
 * Test utilities for type violation checks
 * These utilities provide explicit intent when bypassing type safety in tests
 */

/**
 * Explicitly cast a value to violate type safety for testing purposes.
 * Use this instead of `as any` to make the intent clear.
 *
 * @example
 * ```typescript
 * // Testing error handling for invalid input
 * const invalidInput = violateType<ValidType>({ invalid: 'data' });
 * const result = functionUnderTest(invalidInput);
 * expect(result.isErr()).toBe(true);
 * ```
 */
export function violateType<T>(value: unknown): T {
  return value as T;
}

/**
 * Create a value that explicitly violates the expected type constraints.
 * This is useful for testing validation and error handling.
 *
 * @example
 * ```typescript
 * // Testing that a function rejects invalid configuration
 * const invalidConfig = createInvalidValue<Config>({
 *   wrongField: 'value'
 * });
 * ```
 */
export function createInvalidValue<T>(invalidData: unknown): T {
  return invalidData as T;
}

/**
 * Bypass type checking for testing error paths.
 * Use when you need to test how code handles unexpected types.
 *
 * @example
 * ```typescript
 * // Testing runtime type guards
 * const untypedValue = bypassTypeCheck({ foo: 'bar' });
 * const isValid = isValidType(untypedValue);
 * expect(isValid).toBe(false);
 * ```
 */
export function bypassTypeCheck<T = unknown>(value: unknown): T {
  return value as T;
}

/**
 * Create a mock value that intentionally doesn't match the expected type.
 * Useful for testing type guards and validation functions.
 *
 * @example
 * ```typescript
 * // Testing zod schema validation
 * const mockInvalid = createTypeMismatch<UserSchema>({
 *   age: 'not-a-number'
 * });
 * const result = UserSchema.safeParse(mockInvalid);
 * expect(result.success).toBe(false);
 * ```
 */
export function createTypeMismatch<T>(mismatchedData: unknown): T {
  return mismatchedData as T;
}

/**
 * Force a value to be treated as a specific type for testing.
 * This makes the testing intent explicit.
 *
 * @example
 * ```typescript
 * // Testing that function handles malformed data
 * const malformed = forceType<ValidInput>(null);
 * expect(() => process(malformed)).toThrow();
 * ```
 */
export function forceType<T>(value: unknown): T {
  return value as T;
}
