import { dirname, join, normalize, resolve as resolvePath } from "node:path";
import { err, ok, type Result } from "neverthrow";

import type { ModuleAnalysis, ModuleDefinition } from "./ast/analyze-module";
import type { CanonicalId } from "./registry";
import { createCanonicalId } from "./registry";

export type DependencyGraphNode = {
  readonly id: CanonicalId;
  readonly definition: ModuleDefinition;
  readonly dependencies: readonly CanonicalId[];
  readonly references: Readonly<Record<string, CanonicalId>>;
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

const buildExportTable = (
  modules: readonly ModuleAnalysis[],
  moduleLookup: ReadonlyMap<string, ModuleAnalysis>,
): Map<string, Map<string, CanonicalId>> => {
  const table = new Map<string, Map<string, CanonicalId>>();

  modules.forEach((mod) => {
    const modulePath = normalizePath(mod.filePath);
    const exports = table.get(modulePath) ?? new Map<string, CanonicalId>();

    mod.definitions.forEach((definition) => {
      const id = createCanonicalId(mod.filePath, definition.exportName);
      exports.set(definition.exportName, id);
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

const buildModuleImportMap = (
  module: ModuleAnalysis,
  exportTable: Map<string, Map<string, CanonicalId>>,
  moduleLookup: ReadonlyMap<string, ModuleAnalysis>,
): Map<string, CanonicalId> => {
  const map = new Map<string, CanonicalId>();
  const modulePath = normalizePath(module.filePath);
  const selfExports = exportTable.get(modulePath) ?? new Map<string, CanonicalId>();

  selfExports.forEach((canonicalId, exportName) => {
    map.set(exportName, canonicalId);
  });

  module.imports.forEach((entry) => {
    if (!entry.source.startsWith(".")) {
      return;
    }

    const targetModule = resolveModuleSpecifier(module.filePath, entry.source, moduleLookup);
    if (!targetModule) {
      return;
    }

    const targetExports = exportTable.get(normalizePath(targetModule.filePath));
    if (!targetExports) {
      return;
    }

    if (entry.kind === "namespace") {
      targetExports.forEach((canonicalId, exportedName) => {
        map.set(`${entry.local}.${exportedName}`, canonicalId);
        map.set(exportedName, canonicalId);
      });
      return;
    }

    const exportName = entry.imported === "default" ? "default" : entry.imported;
    const canonical = targetExports.get(exportName);
    if (canonical) {
      map.set(entry.local, canonical);
    }

    targetExports.forEach((canonicalId, exportedName) => {
      const prefix = `${exportName}.`;
      if (!exportedName.startsWith(prefix)) {
        return;
      }

      const suffix = exportedName.slice(prefix.length);
      if (suffix.length === 0) {
        return;
      }

      map.set(`${entry.local}.${suffix}`, canonicalId);
      map.set(exportedName, canonicalId);
    });
  });

  return map;
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

export const buildDependencyGraph = (modules: readonly ModuleAnalysis[]): Result<DependencyGraph, DependencyGraphError> => {
  const graph: DependencyGraph = new Map();

  const moduleLookup = new Map<string, ModuleAnalysis>();
  modules.forEach((module) => {
    moduleLookup.set(normalizePath(module.filePath), module);
  });

  const exportTable = buildExportTable(modules, moduleLookup);

  modules.forEach((module) => {
    const referenceMap = buildModuleImportMap(module, exportTable, moduleLookup);
    // const _modulePath = normalizePath(module.filePath); // unused variable

    module.definitions.forEach((definition) => {
      const id = createCanonicalId(module.filePath, definition.exportName);
      const dependencySet = new Set<CanonicalId>();
      const resolvedReferences: Record<string, CanonicalId> = {};

      definition.references.forEach((reference) => {
        const canonical = referenceMap.get(reference);
        if (canonical && canonical !== id) {
          dependencySet.add(canonical);
          resolvedReferences[reference] = canonical;
        }
      });

      graph.set(id, {
        id,
        definition,
        dependencies: Array.from(dependencySet),
        references: resolvedReferences,
      });
    });
  });

  const cycleCheck = detectCycles(graph);
  if (cycleCheck.isErr()) {
    return err(cycleCheck.error);
  }

  return ok(graph);
};
