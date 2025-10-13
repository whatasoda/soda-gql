import type { Stats } from "node:fs";
import { promises as fs } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";

import type { BuilderChangeSet, BuilderFileChange } from "@soda-gql/builder/change-set";

export type BuilderWatchOptions = {
  readonly rootDir: string;
  readonly schemaHash: string;
  readonly analyzerVersion: string;
};

export interface BuilderWatch {
  trackChanges(modified?: Iterable<string> | null, removed?: Iterable<string> | null): void;
  flush(): Promise<BuilderChangeSet | null>;
  reset(): void;
}

const toAbsolutePath = (rootDir: string, filePath: string): string => {
  const candidate = isAbsolute(filePath) ? filePath : resolve(rootDir, filePath);
  return normalize(candidate);
};

const fingerprintForStats = (stats: Pick<Stats, "mtimeMs" | "size">): string => `${stats.mtimeMs}:${stats.size}`;

const createFileChange = async (filePath: string): Promise<BuilderFileChange | null> => {
  try {
    const stats = await fs.stat(filePath);
    return {
      filePath,
      fingerprint: fingerprintForStats(stats),
      mtimeMs: stats.mtimeMs,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const createBuilderWatch = (options: BuilderWatchOptions): BuilderWatch => {
  const knownFingerprints = new Map<string, string>();
  const pendingModified = new Set<string>();
  const pendingRemoved = new Set<string>();

  const trackChanges = (modified?: Iterable<string> | null, removed?: Iterable<string> | null) => {
    if (modified) {
      for (const path of modified) {
        pendingModified.add(toAbsolutePath(options.rootDir, path));
      }
    }
    if (removed) {
      for (const path of removed) {
        const absolute = toAbsolutePath(options.rootDir, path);
        pendingRemoved.add(absolute);
        pendingModified.delete(absolute);
      }
    }
  };

  const flush = async (): Promise<BuilderChangeSet | null> => {
    if (pendingModified.size === 0 && pendingRemoved.size === 0) {
      return null;
    }

    const added: BuilderFileChange[] = [];
    const updated: BuilderFileChange[] = [];
    const removed: string[] = [];

    for (const path of pendingRemoved) {
      knownFingerprints.delete(path);
      removed.push(path);
    }
    pendingRemoved.clear();

    for (const path of pendingModified) {
      const change = await createFileChange(path);
      if (!change) {
        knownFingerprints.delete(path);
        removed.push(path);
        continue;
      }

      const previous = knownFingerprints.get(path);
      knownFingerprints.set(path, change.fingerprint);

      if (!previous) {
        added.push(change);
      } else if (previous !== change.fingerprint) {
        updated.push(change);
      }
    }
    pendingModified.clear();

    if (added.length === 0 && updated.length === 0 && removed.length === 0) {
      return null;
    }

    return {
      added,
      updated,
      removed,
      metadata: {
        schemaHash: options.schemaHash,
        analyzerVersion: options.analyzerVersion,
      },
    };
  };

  const reset = () => {
    pendingModified.clear();
    pendingRemoved.clear();
    knownFingerprints.clear();
  };

  return {
    trackChanges,
    flush,
    reset,
  };
};
