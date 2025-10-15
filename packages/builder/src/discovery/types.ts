import type { ModuleAnalysis } from "../ast";
import type { FileFingerprint } from "./fingerprint";

/**
 * Result of resolving a single import specifier encountered during discovery.
 */
export type DiscoveredDependency = {
  /** Module specifier exactly as it appeared in source. */
  readonly specifier: string;
  /** Absolute, normalized path when the specifier points to a local file; null for bare package imports. */
  readonly resolvedPath: string | null;
  /** True when the specifier targets an external package (i.e. no local snapshot will exist). */
  readonly isExternal: boolean;
};

/**
 * Immutable cacheable record produced by the discovery phase for a single source file.
 * Captures analyzer output, dependency fan-out, and bookkeeping metadata.
 */
export type DiscoverySnapshot = {
  /** Absolute path to the analyzed file (preserves original casing). */
  readonly filePath: string;
  /** Normalized path (POSIX separators) used as a stable cache key. */
  readonly normalizedFilePath: string;
  /** Signature of the source contents used to validate cache entries. */
  readonly signature: string;
  /** File fingerprint for fast cache invalidation. */
  readonly fingerprint: FileFingerprint;
  /** Analyzer type identifier for cache versioning. */
  readonly analyzer: string;
  /** Milliseconds since epoch when this snapshot was created. */
  readonly createdAtMs: number;
  /** Raw analyzer output (imports, exports, definitions, diagnostics). */
  readonly analysis: ModuleAnalysis;
  /** Resolved graph edges for relative imports encountered in the file. */
  readonly dependencies: readonly DiscoveredDependency[];
};

/**
 * Cache abstraction for storing and retrieving discovery snapshots.
 * Implementations can back onto disk, memory, or remote stores.
 */
export interface DiscoveryCache {
  /**
   * Look up a snapshot by file path and signature.
   * Returns null when the cache entry is missing or stale.
   */
  load(filePath: string, signature: string): DiscoverySnapshot | null;
  /**
   * Peek at cached snapshot without signature validation.
   * Used for fingerprint-based cache invalidation.
   * Returns null when the cache entry is missing.
   */
  peek(filePath: string): DiscoverySnapshot | null;
  /**
   * Persist the provided snapshot.
   */
  store(snapshot: DiscoverySnapshot): void;
  /**
   * Remove a snapshot when a file is deleted or invalidated.
   */
  delete(filePath: string): void;
  /**
   * Enumerate all cached snapshots (used to seed incremental builds).
   */
  entries(): IterableIterator<DiscoverySnapshot>;
  /**
   * Drop every cached entry (useful when analyzer versions change).
   */
  clear(): void;
  /**
   * Total number of entries currently stored.
   */
  size(): number;
}

export type ModuleLoadStats = {
  readonly hits: number;
  readonly misses: number;
  readonly skips: number;
};
