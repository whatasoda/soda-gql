import { statSync } from "node:fs";
import { normalizePath } from "@soda-gql/common";
import { ok, type Result } from "neverthrow";

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
export type TrackerError = { type: "scan-failed"; path: string; message: string };

/**
 * File tracker interface for detecting file changes across builds.
 */
export interface FileTracker {
  /**
   * Scan current file system state for the given paths.
   * Gracefully skips files that don't exist or cannot be read.
   */
  scan(extraPaths: readonly string[]): Result<FileScan, TrackerError>;

  /**
   * Detect changes between previous and current file states.
   */
  detectChanges(): FileDiff;

  /**
   * Update the in-memory tracker state.
   * State persists only for the lifetime of this process.
   */
  update(scan: FileScan): void;
}

/**
 * Create a file tracker that maintains in-memory state for change detection.
 *
 * The tracker keeps file metadata (mtime, size) in memory during the process lifetime
 * and detects which files have been added, updated, or removed. State is scoped to
 * the process and does not persist across restarts.
 */
export const createFileTracker = (): FileTracker => {
  // In-memory state that persists for the lifetime of this tracker instance
  let currentScan: FileScan = {
    files: new Map(),
  };
  let nextScan: FileScan | null = null;

  const scan = (extraPaths: readonly string[]): Result<FileScan, TrackerError> => {
    const allPathsToScan = new Set([...extraPaths, ...currentScan.files.keys()]);
    const files = new Map<string, FileMetadata>();

    for (const path of allPathsToScan) {
      try {
        const normalized = normalizePath(path);
        const stats = statSync(normalized);

        files.set(normalized, {
          mtimeMs: stats.mtimeMs,
          size: stats.size,
        });
      } catch {}
    }

    nextScan = { files };
    return ok(nextScan);
  };

  const detectChanges = (): FileDiff => {
    const previous = currentScan;
    const current = nextScan ?? currentScan;
    const added = new Set<string>();
    const updated = new Set<string>();
    const removed = new Set<string>();

    // Check for added and updated files
    for (const [path, currentMetadata] of current.files) {
      const previousMetadata = previous.files.get(path);

      if (!previousMetadata) {
        added.add(path);
      } else if (previousMetadata.mtimeMs !== currentMetadata.mtimeMs || previousMetadata.size !== currentMetadata.size) {
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

  const update = (scan: FileScan): void => {
    // Update in-memory state - promote nextScan to currentScan
    currentScan = scan;
    nextScan = null;
  };

  return {
    scan,
    detectChanges,
    update,
  };
};

/**
 * Check if a file diff is empty (no changes detected).
 */
export const isEmptyDiff = (diff: FileDiff): boolean => {
  return diff.added.size === 0 && diff.updated.size === 0 && diff.removed.size === 0;
};
