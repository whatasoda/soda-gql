/**
 * Runtime detection utilities for portable API implementation
 */

export const runtime = {
	isBun: typeof Bun !== "undefined",
	isNode: typeof process !== "undefined" && typeof Bun === "undefined",
	supportsWebCrypto:
		typeof crypto !== "undefined" &&
		typeof crypto.subtle !== "undefined",
} as const;

/**
 * Helper to cache module imports to avoid repeated dynamic imports
 */
export function once<T>(fn: () => T): () => T {
	let result: T | undefined;
	let called = false;

	return () => {
		if (!called) {
			result = fn();
			called = true;
		}
		return result as T;
	};
}

/**
 * Reset runtime state for testing purposes only
 * @internal
 */
export function resetPortableForTests(): void {
	// This is a marker function that portable modules can use
	// to reset their singleton state in tests
}
