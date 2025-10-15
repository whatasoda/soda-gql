/**
 * Represents a file change with metadata for incremental builds.
 */
export type BuilderFileChange = {
  readonly filePath: string;
  readonly fingerprint: string;
  readonly mtimeMs: number;
};

/**
 * Represents a set of changes to builder inputs for incremental processing.
 */
export type BuilderChangeSet = {
  readonly added: readonly BuilderFileChange[] | ReadonlySet<BuilderFileChange | string>;
  readonly updated: readonly BuilderFileChange[] | ReadonlySet<BuilderFileChange | string>;
  readonly removed: readonly string[] | ReadonlySet<string>;
  readonly metadata?: {
    readonly schemaHash?: string;
    readonly analyzerVersion?: string;
  };
};

/**
 * Check if fingerprint has changed, indicating file modification.
 */
export const hasFileChanged = (currentFingerprint: string | undefined, incomingFingerprint: string): boolean => {
  return currentFingerprint !== incomingFingerprint;
};

/**
 * Normalize BuilderChangeSet paths to absolute strings with consistent path format.
 * Handles both BuilderFileChange objects and raw string paths.
 * All paths are normalized to POSIX format for consistent cache key matching.
 * Uses Node.js normalize() + backslash replacement to match normalizePath from @soda-gql/common.
 */
export const coercePaths = (
  changes: readonly BuilderFileChange[] | readonly string[] | ReadonlySet<string | BuilderFileChange>,
): Set<string> => {
  const { normalize } = require("node:path");

  if (Array.isArray(changes)) {
    return new Set(
      changes.map((c) => {
        const path = typeof c === "string" ? c : c.filePath;
        // Normalize to POSIX format to match discovery cache keys (normalize() + replace backslashes)
        return normalize(path).replace(/\\/g, "/");
      }),
    );
  }

  const result = new Set<string>();
  for (const item of changes) {
    const path = typeof item === "string" ? item : item.filePath;
    // Normalize to POSIX format to match discovery cache keys (normalize() + replace backslashes)
    result.add(normalize(path).replace(/\\/g, "/"));
  }
  return result;
};
