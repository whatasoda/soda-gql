/**
 * Portable ID generation that works on both Bun and Node.js
 */

import { runtime } from "./runtime";

/**
 * Generate a unique ID
 * Uses UUIDv7 on Bun (monotonic), falls back to randomUUID on Node.js
 */
export function generateId(): string {
	if (
		runtime.isBun &&
		typeof Bun !== "undefined" &&
		typeof Bun.randomUUIDv7 === "function"
	) {
		return Bun.randomUUIDv7();
	}

	// Node.js fallback: use crypto.randomUUID
	const crypto = require("node:crypto");
	return crypto.randomUUID();
}
