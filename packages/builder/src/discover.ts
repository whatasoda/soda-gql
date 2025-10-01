import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";
import { err, ok } from "neverthrow";

import type { BuilderError } from "./types";

const scanEntries = (pattern: string): readonly string[] => {
  const glob = new Glob(pattern);
  return Array.from(glob.scanSync(process.cwd()));
};

/**
 * Resolve entry file paths from glob patterns or direct paths.
 * Used by the discovery system to find entry points for module traversal.
 */
export const resolveEntryPaths = (entries: readonly string[]) => {
  const resolvedPaths = entries.flatMap((entry) => {
    const absolute = resolve(entry);
    if (existsSync(absolute)) {
      return [absolute];
    }

    const matches = scanEntries(entry).map((match) => resolve(match));
    return matches;
  });

  if (resolvedPaths.length === 0) {
    return err<readonly string[], BuilderError>({
      code: "ENTRY_NOT_FOUND",
      message: `No entry files matched ${entries.join(", ")}`,
      entry: entries.join(", "),
    });
  }

  return ok<readonly string[], BuilderError>(resolvedPaths);
};
