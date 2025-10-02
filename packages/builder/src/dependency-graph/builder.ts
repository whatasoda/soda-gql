import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";
import { createCanonicalId, type CanonicalId } from "../registry";
import { detectCycles } from "./cycles";
import { buildExportTable } from "./export-table";
import { normalizePath } from "./paths";
import { buildModuleDependencies, buildModuleSummaries } from "./summaries";
import type { DependencyGraph, DependencyGraphError } from "./types";

export const buildDependencyGraph = (modules: readonly ModuleAnalysis[]): Result<DependencyGraph, DependencyGraphError> => {
  const graph: DependencyGraph = new Map();

  const moduleLookup = new Map<string, ModuleAnalysis>();
  modules.forEach((module) => {
    moduleLookup.set(normalizePath(module.filePath), module);
  });

  const exportTable = buildExportTable(modules, moduleLookup);
  const summaries = buildModuleSummaries(modules, exportTable);

  modules.forEach((module) => {
    const modulePath = normalizePath(module.filePath);
    const summary = summaries.get(modulePath);
    if (!summary) {
      return;
    }

    // Build module-level dependencies (all gql exports from imported modules)
    const moduleDependencies = buildModuleDependencies(modulePath, summary, summaries, moduleLookup);

    module.definitions.forEach((definition) => {
      const id = createCanonicalId(module.filePath, definition.astPath);
      const dependencySet = new Set<CanonicalId>();

      // Use module-level dependencies instead of expression analysis
      moduleDependencies.forEach((depId) => {
        if (depId !== id) {
          dependencySet.add(depId);
        }
      });

      graph.set(id, {
        id,
        filePath: modulePath,
        localPath: definition.astPath,
        isExported: definition.isExported,
        definition,
        dependencies: Array.from(dependencySet),
        moduleSummary: summary,
      });
    });
  });

  const cycleCheck = detectCycles(graph);
  if (cycleCheck.isErr()) {
    return err(cycleCheck.error);
  }

  return ok(graph);
};
