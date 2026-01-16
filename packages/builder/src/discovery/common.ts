import {
  type AliasResolver,
  getPortableHasher,
  isExternalSpecifier,
  resolveRelativeImportWithExistenceCheck,
} from "@soda-gql/common";
import type { ModuleAnalysis } from "../ast/types";
import type { DiscoveredDependency } from "./types";

/**
 * Options for extracting module dependencies.
 */
export type ExtractModuleDependenciesOptions = {
  readonly analysis: ModuleAnalysis;
  /** Optional alias resolver for tsconfig paths */
  readonly aliasResolver?: AliasResolver;
};

/**
 * Extract all unique dependencies (relative + external) from the analysis.
 * Resolves local specifiers immediately so discovery only traverses once.
 *
 * Resolution order:
 * 1. Relative imports → resolveRelativeImportWithExistenceCheck
 * 2. Alias imports (if aliasResolver provided) → aliasResolver.resolve
 * 3. Otherwise → mark as external
 */
export const extractModuleDependencies = ({
  analysis,
  aliasResolver,
}: ExtractModuleDependenciesOptions): readonly DiscoveredDependency[] => {
  const dependencies = new Map<string, DiscoveredDependency>();

  const addDependency = (specifier: string): void => {
    if (dependencies.has(specifier)) {
      return;
    }

    // Try relative import first
    if (!isExternalSpecifier(specifier)) {
      const resolvedPath = resolveRelativeImportWithExistenceCheck({
        filePath: analysis.filePath,
        specifier,
      });
      dependencies.set(specifier, {
        specifier,
        resolvedPath,
        isExternal: false,
      });
      return;
    }

    // Try alias resolution if available
    if (aliasResolver) {
      const resolvedPath = aliasResolver.resolve(specifier);
      if (resolvedPath) {
        dependencies.set(specifier, {
          specifier,
          resolvedPath,
          isExternal: false,
        });
        return;
      }
    }

    // External package
    dependencies.set(specifier, {
      specifier,
      resolvedPath: null,
      isExternal: true,
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
