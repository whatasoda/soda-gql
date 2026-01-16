/**
 * Portable hashing API using Node.js crypto
 */

import { createHash } from "node:crypto";

export type HashAlgorithm = "sha256" | "xxhash";

export interface PortableHasher {
  hash(content: string, algorithm?: HashAlgorithm): string;
}

export function createPortableHasher(): PortableHasher {
  return {
    hash(content, algorithm = "xxhash") {
      if (algorithm === "sha256") {
        return createHash("sha256").update(content).digest("hex");
      }
      // xxhash fallback: use sha256 truncated to 16 chars
      const sha256Hash = createHash("sha256").update(content).digest("hex");
      return sha256Hash.substring(0, 16);
    },
  };
}

// Singleton to avoid recreating instances
let hasherInstance: PortableHasher | null = null;

export function getPortableHasher(): PortableHasher {
  if (!hasherInstance) {
    hasherInstance = createPortableHasher();
  }
  return hasherInstance;
}

/**
 * Reset the hasher singleton for testing
 * @internal
 */
export function __resetPortableHasherForTests(): void {
  hasherInstance = null;
}
