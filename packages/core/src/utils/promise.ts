/**
 * Promise detection utilities for cross-realm compatibility.
 * @module
 */

/**
 * Check if a value is Promise-like (has .then method).
 *
 * This function uses duck typing instead of `instanceof Promise` to work across
 * VM sandbox boundaries where Promises created in a different realm have a
 * different constructor.
 *
 * @example
 * ```typescript
 * // Works with native Promises
 * isPromiseLike(Promise.resolve(42)); // true
 *
 * // Works with VM sandbox Promises (instanceof would fail)
 * const vmPromise = vm.runInContext("Promise.resolve(42)", context);
 * isPromiseLike(vmPromise); // true (instanceof Promise would be false)
 *
 * // Rejects non-Promises
 * isPromiseLike({ then: "not a function" }); // false
 * isPromiseLike(null); // false
 * isPromiseLike(42); // false
 * ```
 */
export const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> => {
  return value !== null && typeof value === "object" && "then" in value && typeof value.then === "function";
};
