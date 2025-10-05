/**
 * Represents a file change with metadata for incremental builds.
 */
export type BuilderFileChange = {
  readonly filePath: string;
  readonly fingerprint: string;
  readonly mtimeMs: number;
};

/**
 * Metadata for validating incremental build compatibility.
 */
export type BuilderChangeSetMetadata = {
  readonly schemaHash: string;
  readonly analyzerVersion: string;
};

/**
 * Represents a set of changes to builder inputs for incremental processing.
 */
export type BuilderChangeSet = {
  readonly added: readonly BuilderFileChange[];
  readonly updated: readonly BuilderFileChange[];
  readonly removed: readonly string[];
  readonly metadata: BuilderChangeSetMetadata;
};

/**
 * Check if schema hash has changed, requiring full rebuild.
 */
export const shouldInvalidateSchema = (current: string, incoming: string): boolean => {
  return current !== incoming;
};

/**
 * Check if analyzer version has changed, requiring full rebuild.
 */
export const shouldInvalidateAnalyzer = (current: string, incoming: string): boolean => {
  return current !== incoming;
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
export const coercePaths = (changes: readonly BuilderFileChange[] | ReadonlySet<string | BuilderFileChange>): Set<string> => {
  if (Array.isArray(changes)) {
    return new Set(changes.map((c) => c.filePath));
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
