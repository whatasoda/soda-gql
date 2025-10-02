import { dirname, join, normalize, resolve as resolvePath } from "node:path";
import { err, ok, type Result } from "neverthrow";

import type { ModuleAnalysis, ModuleDefinition, ModuleImport } from "./ast";
import type { CanonicalId } from "./registry";
import { createCanonicalId } from "./registry";

/**
 * Per-file metadata for module-level dependency analysis.
 * Tracks imports and gql exports without analyzing expression ASTs.
 */
export type ModuleSummary = {
  readonly filePath: string;
  /** All import statements from this module */
  readonly runtimeImports: readonly ModuleImport[];
  /** Canonical IDs of all gql definitions exported from this module */
  readonly gqlExports: readonly CanonicalId[];
};

export type DependencyGraphNode = {
  readonly id: CanonicalId;
  /** Absolute file path of the module containing this definition */
  readonly filePath: string;
  /** Local path within the module (e.g., "userModel" or "foo.bar" for nested exports) */
  readonly localPath: string;
  /** Whether this definition is exported from its module */
  readonly isExported: boolean;
  readonly definition: ModuleDefinition;
  readonly dependencies: readonly CanonicalId[];
  /** Module summary for the file containing this node */
  readonly moduleSummary: ModuleSummary;
};

export type DependencyGraph = Map<CanonicalId, DependencyGraphNode>;

export type DependencyGraphError = {
  readonly code: "CIRCULAR_DEPENDENCY";
  readonly chain: readonly CanonicalId[];
};

const normalizePath = (value: string): string => normalize(value).replace(/\\/g, "/");

const resolveModuleSpecifier = (
  currentFile: string,
  specifier: string,
  candidates: ReadonlyMap<string, ModuleAnalysis>,
): ModuleAnalysis | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = normalizePath(resolvePath(dirname(currentFile), specifier));
  const possible = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];

  for (const candidate of possible) {
    const module = candidates.get(normalizePath(candidate));
    if (module) {
      return module;
    }
  }

  return null;
};

/**
 * Build module summaries for all modules.
 * Each summary contains the module's imports and exported gql definitions.
 * Uses the export table to resolve re-exports.
 */
const buildModuleSummaries = (
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

const buildExportTable = (
  modules: readonly ModuleAnalysis[],
  moduleLookup: ReadonlyMap<string, ModuleAnalysis>,
): Map<string, Map<string, CanonicalId>> => {
  const table = new Map<string, Map<string, CanonicalId>>();

  modules.forEach((mod) => {
    const modulePath = normalizePath(mod.filePath);
    const exports = table.get(modulePath) ?? new Map<string, CanonicalId>();

    mod.definitions.forEach((definition) => {
      const id = createCanonicalId(mod.filePath, definition.astPath);
      // Map both astPath and deprecated exportName for backward compatibility during migration
      exports.set(definition.astPath, id);
      if (definition.exportName !== definition.astPath) {
        exports.set(definition.exportName, id);
      }
    });

    mod.exports.forEach((entry) => {
      if (entry.kind === "named") {
        const canonical = exports.get(entry.local);
        if (canonical) {
          exports.set(entry.exported, canonical);
        }
        return;
      }
    });

    table.set(modulePath, exports);
  });

  // Resolve re-exports in a second pass
  modules.forEach((mod) => {
    const modulePath = normalizePath(mod.filePath);
    const exports = table.get(modulePath) ?? new Map<string, CanonicalId>();

    mod.exports.forEach((entry) => {
      if (entry.kind !== "reexport") {
        return;
      }

      const targetModule = resolveModuleSpecifier(mod.filePath, entry.source, moduleLookup);
      if (!targetModule) {
        return;
      }

      const targetExports = table.get(normalizePath(targetModule.filePath));
      if (!targetExports) {
        return;
      }

      if (entry.exported === "*") {
        targetExports.forEach((canonicalId, exportedName) => {
          exports.set(exportedName, canonicalId);
        });
        return;
      }

      const targetName = entry.local ?? entry.exported;
      const canonical = targetExports.get(targetName);
      if (canonical) {
        exports.set(entry.exported, canonical);
      }
    });
  });

  return table;
};

const detectCycles = (graph: DependencyGraph): Result<void, DependencyGraphError> => {
  const visited = new Set<CanonicalId>();
  const stack = new Set<CanonicalId>();

  const visit = (nodeId: CanonicalId, chain: CanonicalId[]): Result<void, DependencyGraphError> => {
    if (stack.has(nodeId)) {
      return err({
        code: "CIRCULAR_DEPENDENCY",
        chain: [...chain, nodeId],
      });
    }

    if (visited.has(nodeId)) {
      return ok(undefined);
    }

    visited.add(nodeId);
    stack.add(nodeId);

    const node = graph.get(nodeId);
    if (node) {
      for (const dependency of node.dependencies) {
        const result = visit(dependency, [...chain, nodeId]);
        if (result.isErr()) {
          return result;
        }
      }
    }

    stack.delete(nodeId);
    return ok(undefined);
  };

  for (const nodeId of graph.keys()) {
    const result = visit(nodeId, []);
    if (result.isErr()) {
      return result;
    }
  }

  return ok(undefined);
};

/**
 * Build module-level dependencies for a file.
 * Returns canonical IDs of all gql exports from imported modules.
 */
const buildModuleDependencies = (
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
