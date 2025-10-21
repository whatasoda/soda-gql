import { getPortableHasher, isExternalSpecifier, resolveRelativeImportWithExistenceCheck } from "@soda-gql/common";
import type { ModuleAnalysis } from "../ast/types";
import type { DiscoveredDependency } from "./types";

/**
 * Extract all unique dependencies (relative + external) from the analysis.
 * Resolves local specifiers immediately so discovery only traverses once.
 */
export const extractModuleDependencies = (analysis: ModuleAnalysis): readonly DiscoveredDependency[] => {
  const dependencies = new Map<string, DiscoveredDependency>();

  const addDependency = (specifier: string): void => {
    if (dependencies.has(specifier)) {
      return;
    }

    const isExternal = isExternalSpecifier(specifier);
    const resolvedPath = isExternal ? null : resolveRelativeImportWithExistenceCheck({ filePath: analysis.filePath, specifier });

    dependencies.set(specifier, {
      specifier,
      resolvedPath,
      isExternal,
    });
  };

  for (const imp of analysis.imports) {
    addDependency(imp.source);
  }

  for (const exp of analysis.exports) {
    if (exp.kind === "reexport") {
      addDependency(exp.source);
    }
  }

  return Array.from(dependencies.values());
};

export const createSourceHash = (source: string): string => {
  const hasher = getPortableHasher();
  return hasher.hash(source, "xxhash");
};
