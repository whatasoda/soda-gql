import type { ModuleAnalysis } from "../ast/types";
import { isExternalSpecifier, resolveRelativeImport } from "../utils/path-utils";
import type { DiscoveredDependency } from "./types";
import { getPortableHasher } from "@soda-gql/common";

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
    const resolvedPath = isExternal ? null : resolveRelativeImport(analysis.filePath, specifier);

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
