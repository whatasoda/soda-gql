/**
 * Portable hashing API that works on both Bun and Node.js
 */

import { once, runtime } from "./runtime";

export type HashAlgorithm = "sha256" | "xxhash";

export interface PortableHasher {
  hash(content: string, algorithm?: HashAlgorithm): string;
}

interface NodeCrypto {
  createHash: (algorithm: string) => {
    update: (data: string) => { digest: (encoding: string) => string };
  };
}

// Cache the crypto import
const getNodeCrypto = once(async (): Promise<NodeCrypto> => {
  const crypto = await import("node:crypto");
  return crypto as unknown as NodeCrypto;
});

/**
 * Pads a hex string to the specified length
 */
function padHex(hex: string, length: number): string {
  return hex.padStart(length, "0");
}

export function createPortableHasher(): PortableHasher {
  if (runtime.isBun) {
    return {
      hash(content, algorithm = "xxhash") {
        if (algorithm === "sha256") {
          const hasher = new Bun.CryptoHasher("sha256");
          hasher.update(content);
          return hasher.digest("hex");
        }
        // xxhash - Bun.hash returns a number
        const hashNum = Bun.hash(content);
        // Convert to hex and pad to 16 chars for consistency
        return padHex(hashNum.toString(16), 16);
      },
    };
  }

  // Node.js implementation
  return {
    hash(content, algorithm = "xxhash") {
      if (algorithm === "sha256") {
        const crypto = require("node:crypto");
        return crypto.createHash("sha256").update(content).digest("hex");
      }
      // xxhash fallback: use sha256 for now (can add xxhash package later if needed)
      // This ensures consistent behavior across runtimes
      const crypto = require("node:crypto");
      const sha256Hash = crypto.createHash("sha256").update(content).digest("hex");
      // Take first 16 chars to match xxhash output length
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
