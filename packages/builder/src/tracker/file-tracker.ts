import { statSync } from "node:fs";
import { normalizePath } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { JsonCacheFactory } from "../cache/json-cache";

/**
 * File metadata tracked for change detection.
 */
export type FileMetadata = {
  /** Modification time in milliseconds */
  mtimeMs: number;
  /** File size in bytes */
  size: number;
};

/**
 * Persistent state of tracked files.
 */
export type FileTrackerState = {
  /** Version for cache invalidation */
  version: number;
  /** Map of normalized file paths to metadata */
  files: Map<string, FileMetadata>;
};

/**
 * Result of scanning current file system state.
 */
export type FileScan = {
  /** Map of normalized file paths to current metadata */
  files: Map<string, FileMetadata>;
};

/**
 * Detected file changes between two states.
 */
export type FileDiff = {
  /** Files present in current but not in previous */
  added: Set<string>;
  /** Files present in both but with changed metadata */
  updated: Set<string>;
  /** Files present in previous but not in current */
  removed: Set<string>;
};

/**
 * Errors that can occur during file tracking operations.
 */
export type TrackerError =
  | { type: "cache-read-failed"; message: string }
  | { type: "cache-write-failed"; message: string }
  | { type: "scan-failed"; path: string; message: string };

/**
 * File tracker interface for detecting file changes across builds.
 */
export interface FileTracker {
  /**
   * Load previously persisted tracker state from cache.
   * Returns empty state if no cache exists or cache is invalid.
   */
  loadState(): Result<FileTrackerState, TrackerError>;

  /**
   * Scan current file system state for the given paths.
   * Gracefully skips files that don't exist or cannot be read.
   */
  scan(paths: readonly string[]): Result<FileScan, TrackerError>;

  /**
   * Detect changes between previous and current file states.
   */
  detectChanges(previous: FileTrackerState, current: FileScan): FileDiff;

  /**
   * Persist current tracker state to cache for next build.
   */
  persist(state: FileTrackerState): Result<void, TrackerError>;
}

/**
 * Options for creating a file tracker.
 */
export type FileTrackerOptions = {
  /** JSON cache factory to use for persistence */
  cacheFactory: JsonCacheFactory;
};

const TRACKER_VERSION = 1;
const CACHE_NAMESPACE = ["file-tracker"];
const CACHE_KEY = "state";

/**
 * Zod schema for file metadata.
 */
const fileMetadataSchema = z.object({
  mtimeMs: z.number(),
  size: z.number(),
});

/**
 * Zod schema for tracker state persistence.
 */
const trackerStateSchema = z.object({
  version: z.number(),
  files: z.record(z.string(), fileMetadataSchema),
});

/**
 * Create a file tracker that maintains independent state for change detection.
 *
 * The tracker persists file metadata (mtime, size) across builds and detects
 * which files have been added, updated, or removed. It is completely independent
 * of the discovery mechanism and maintains its own cache.
 */
export const createFileTracker = ({ cacheFactory }: FileTrackerOptions): FileTracker => {
  const cache = cacheFactory.createStore({
    namespace: CACHE_NAMESPACE,
    schema: trackerStateSchema,
    version: `v${TRACKER_VERSION}`,
  });

  const loadState = (): Result<FileTrackerState, TrackerError> => {
    try {
      const cached = cache.load(CACHE_KEY);

      if (!cached) {
        return ok({
          version: TRACKER_VERSION,
          files: new Map(),
        });
      }

      // Convert plain object to Map
      const files = new Map(Object.entries(cached.files));

      return ok({
        version: cached.version,
        files,
      });
    } catch (error) {
      // Non-fatal: return empty state and let the build proceed
      return ok({
        version: TRACKER_VERSION,
        files: new Map(),
      });
    }
  };

  const scan = (paths: readonly string[]): Result<FileScan, TrackerError> => {
    const files = new Map<string, FileMetadata>();

    for (const path of paths) {
      try {
        const normalized = normalizePath(path);
        const stats = statSync(normalized);

        files.set(normalized, {
          mtimeMs: stats.mtimeMs,
          size: stats.size,
        });
      } catch {
        // Gracefully skip files that don't exist or cannot be read
        continue;
      }
    }

    return ok({ files });
  };

  const detectChanges = (previous: FileTrackerState, current: FileScan): FileDiff => {
    const added = new Set<string>();
    const updated = new Set<string>();
    const removed = new Set<string>();

    // Check for added and updated files
    for (const [path, currentMetadata] of current.files) {
      const previousMetadata = previous.files.get(path);

      if (!previousMetadata) {
        added.add(path);
      } else if (
        previousMetadata.mtimeMs !== currentMetadata.mtimeMs ||
        previousMetadata.size !== currentMetadata.size
      ) {
        updated.add(path);
      }
    }

    // Check for removed files
    for (const path of previous.files.keys()) {
      if (!current.files.has(path)) {
        removed.add(path);
      }
    }

    return { added, updated, removed };
  };

  const persist = (state: FileTrackerState): Result<void, TrackerError> => {
    try {
      // Convert Map to plain object for JSON serialization
      const filesObject: Record<string, FileMetadata> = {};
      for (const [path, metadata] of state.files) {
        filesObject[path] = metadata;
      }

      cache.store(CACHE_KEY, {
        version: state.version,
        files: filesObject,
      });

      return ok(undefined);
    } catch (error) {
      return err({
        type: "cache-write-failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    loadState,
    scan,
    detectChanges,
    persist,
  };
};

/**
 * Check if a file diff is empty (no changes detected).
 */
export const isEmptyDiff = (diff: FileDiff): boolean => {
  return diff.added.size === 0 && diff.updated.size === 0 && diff.removed.size === 0;
};
