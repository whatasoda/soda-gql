import { readFileSync, statSync } from "node:fs";
import { err, ok, type Result } from "neverthrow";
import type { XXHashAPI } from "xxhash-wasm";

/**
 * File fingerprint containing hash, size, and modification time
 */
export type FileFingerprint = {
  /** xxHash hash of file contents */
  hash: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modification time in milliseconds since epoch */
  mtimeMs: number;
};

/**
 * Fingerprint computation error types
 */
export type FingerprintError =
  | { code: "FILE_NOT_FOUND"; path: string; message: string }
  | { code: "NOT_A_FILE"; path: string; message: string }
  | { code: "READ_ERROR"; path: string; message: string };

/**
 * In-memory fingerprint cache keyed by absolute path
 */
const fingerprintCache = new Map<string, FileFingerprint>();

/**
 * Lazy-loaded xxhash instance
 */
let xxhashInstance: XXHashAPI | null = null;

/**
 * Lazily load xxhash-wasm instance
 */
async function getXXHash(): Promise<XXHashAPI> {
  if (xxhashInstance === null) {
    const { default: xxhash } = await import("xxhash-wasm");
    xxhashInstance = await xxhash();
  }
  return xxhashInstance;
}

/**
 * Compute file fingerprint with memoization.
 * Uses mtime to short-circuit re-hashing unchanged files.
 *
 * @param path - Absolute path to file
 * @returns Result containing FileFingerprint or FingerprintError
 */
export function computeFingerprint(path: string): Result<FileFingerprint, FingerprintError> {
  try {
    const stats = statSync(path);

    if (!stats.isFile()) {
      return err({
        code: "NOT_A_FILE",
        path,
        message: `Path is not a file: ${path}`,
      });
    }

    const mtimeMs = stats.mtimeMs;
    const cached = fingerprintCache.get(path);

    // Short-circuit if mtime unchanged
    if (cached && cached.mtimeMs === mtimeMs) {
      return ok(cached);
    }

    // Read and hash file contents
    const contents = readFileSync(path);
    const sizeBytes = stats.size;

    // Compute hash synchronously (xxhash-wasm will be loaded async first time)
    const hash = computeHashSync(contents);

    const fingerprint: FileFingerprint = {
      hash,
      sizeBytes,
      mtimeMs,
    };

    fingerprintCache.set(path, fingerprint);
    return ok(fingerprint);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return err({
        code: "FILE_NOT_FOUND",
        path,
        message: `File not found: ${path}`,
      });
    }

    return err({
      code: "READ_ERROR",
      path,
      message: `Failed to read file: ${error}`,
    });
  }
}

/**
 * Compute hash synchronously.
 * For first call, uses simple string hash as fallback.
 * Subsequent calls will use xxhash after async initialization.
 */
function computeHashSync(contents: Buffer): string {
  // If xxhash is already loaded, use it
  if (xxhashInstance !== null) {
    const hash = xxhashInstance.h64Raw(new Uint8Array(contents));
    return hash.toString(16);
  }

  // First call: trigger async loading for next time
  void getXXHash();

  // Fallback: simple hash for first call only
  return simpleHash(contents);
}

/**
 * Simple hash function for initial calls before xxhash loads
 */
function simpleHash(buffer: Buffer): string {
  let hash = 0;
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte !== undefined) {
      hash = (hash << 5) - hash + byte;
      hash = hash & hash; // Convert to 32bit integer
    }
  }
  return hash.toString(16);
}

/**
 * Invalidate cached fingerprint for a specific path
 *
 * @param path - Absolute path to invalidate
 */
export function invalidateFingerprint(path: string): void {
  fingerprintCache.delete(path);
}

/**
 * Clear all cached fingerprints
 */
export function clearFingerprintCache(): void {
  fingerprintCache.clear();
}
