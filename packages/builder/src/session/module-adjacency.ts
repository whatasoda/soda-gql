import { resolveRelativeImportWithReferences } from "@soda-gql/common";
import type { DiscoverySnapshot } from "../discovery";

/**
 * Extract module-level adjacency from dependency graph.
 * Returns Map of file path -> set of files that import it.
 * All paths are normalized to POSIX format for consistent cache key matching.
 */
export const extractModuleAdjacency = ({
  snapshots,
}: {
  snapshots: Map<string, DiscoverySnapshot>;
}): Map<string, Set<string>> => {
  const importsByModule = new Map<string, Set<string>>();

  for (const snapshot of snapshots.values()) {
    const { normalizedFilePath, dependencies, analysis } = snapshot;
    const imports = new Set<string>();

    // Extract module paths from canonical IDs in dependencies
    for (const { resolvedPath } of dependencies) {
      if (resolvedPath && resolvedPath !== normalizedFilePath && snapshots.has(resolvedPath)) {
        imports.add(resolvedPath);
      }
    }

    // Phase 3: Handle runtime imports for modules with no tracked dependencies
    if (dependencies.length === 0 && analysis.imports.length > 0) {
      for (const imp of analysis.imports) {
        if (imp.isTypeOnly) {
          continue;
        }

        const resolved = resolveRelativeImportWithReferences({
          filePath: normalizedFilePath,
          specifier: imp.source,
          references: snapshots,
        });
        if (resolved) {
          imports.add(resolved);
        }
      }
    }

    if (imports.size > 0) {
      importsByModule.set(normalizedFilePath, imports);
    }
  }

  // Phase 4: Invert to adjacency map (imported -> [importers])
  const adjacency = new Map<string, Set<string>>();

  for (const [importer, imports] of importsByModule) {
    for (const imported of imports) {
      if (!adjacency.has(imported)) {
        adjacency.set(imported, new Set());
      }
      adjacency.get(imported)?.add(importer);
    }
  }

  // Include all modules, even isolated ones with no importers
  for (const modulePath of snapshots.keys()) {
    if (!adjacency.has(modulePath)) {
      adjacency.set(modulePath, new Set());
    }
  }

  return adjacency;
};

/**
 * Collect all modules affected by changes, including transitive dependents.
 * Uses BFS to traverse module adjacency graph.
 * All paths are already normalized from extractModuleAdjacency.
 */
export const collectAffectedFiles = (input: {
  changedFiles: Set<string>;
  removedFiles: Set<string>;
  previousModuleAdjacency: Map<string, Set<string>>;
}): Set<string> => {
  const { changedFiles, removedFiles, previousModuleAdjacency } = input;
  const affected = new Set<string>([...changedFiles, ...removedFiles]);
  const queue = [...changedFiles];
  const visited = new Set<string>(changedFiles);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const dependents = previousModuleAdjacency.get(current);

    if (dependents) {
      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }
  }

  return affected;
};
