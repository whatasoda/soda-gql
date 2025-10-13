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
 * Normalize BuilderChangeSet paths to absolute strings.
 * Handles both BuilderFileChange objects and raw string paths.
 */
export const coercePaths = (
  changes: readonly BuilderFileChange[] | readonly string[] | ReadonlySet<string | BuilderFileChange>,
): Set<string> => {
  if (Array.isArray(changes)) {
    return new Set(changes.map((c) => (typeof c === "string" ? c : c.filePath)));
  }

  const result = new Set<string>();
  for (const item of changes) {
    if (typeof item === "string") {
      result.add(item);
    } else {
      result.add(item.filePath);
    }
  }
  return result;
};
