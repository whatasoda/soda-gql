/**
 * Runtime detection utilities for portable API implementation
 * Note: Bun-specific code has been removed. Node.js APIs are always used.
 */

export const runtime = {
  isBun: false,
  isNode: typeof process !== "undefined",
  supportsWebCrypto: typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined",
} as const;

/**
 * Reset runtime state for testing purposes only
 * @internal
 */
export function resetPortableForTests(): void {
  // This is a marker function that portable modules can use
  // to reset their singleton state in tests
}
