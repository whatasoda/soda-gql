import type { ModuleAnalysis } from "../ast";
import type { CanonicalId } from "../canonical-id/canonical-id";
import { normalizePath, resolveModuleSpecifier } from "./paths";
import type { ModuleSummary } from "./types";

/**
 * Build module summaries for all modules.
 * Each summary contains the module's imports and exported gql definitions.
 * Uses the export table to resolve re-exports.
 */
export const buildModuleSummaries = (
  modules: readonly ModuleAnalysis[],
  exportTable: Map<string, Map<string, CanonicalId>>,
): Map<string, ModuleSummary> => {
  const summaries = new Map<string, ModuleSummary>();

  modules.forEach((mod) => {
    const modulePath = normalizePath(mod.filePath);

    // Get all exported canonical IDs from the export table
    // This includes re-exports
    const moduleExports = exportTable.get(modulePath);
    const gqlExports: CanonicalId[] = moduleExports ? Array.from(new Set(moduleExports.values())) : [];

    // Filter out type-only imports
    const runtimeImports = mod.imports.filter((imp) => !imp.isTypeOnly);

    summaries.set(modulePath, {
      filePath: modulePath,
      runtimeImports,
      gqlExports,
    });
  });

  return summaries;
};

/**
 * Build module-level dependencies for a file.
 * Returns canonical IDs of all gql exports from imported modules.
 */
export const buildModuleDependencies = (
  modulePath: string,
  summary: ModuleSummary,
  summaries: Map<string, ModuleSummary>,
  moduleLookup: ReadonlyMap<string, ModuleAnalysis>,
): Set<CanonicalId> => {
  const dependencies = new Set<CanonicalId>();

  // Include all gql exports from imported modules
  summary.runtimeImports.forEach((imp) => {
    // Only process relative imports (project modules)
    if (!imp.source.startsWith(".")) {
      return;
    }

    const targetModule = resolveModuleSpecifier(modulePath, imp.source, moduleLookup);
    if (!targetModule) {
      return;
    }

    const targetPath = normalizePath(targetModule.filePath);
    const targetSummary = summaries.get(targetPath);
    if (!targetSummary) {
      return;
    }

    // Add all gql exports from the imported module
    targetSummary.gqlExports.forEach((canonicalId) => {
      dependencies.add(canonicalId);
    });
  });

  return dependencies;
};
