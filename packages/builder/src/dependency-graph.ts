import { dirname, join, normalize, resolve as resolvePath } from "node:path";
import { err, ok, type Result } from "neverthrow";
import ts from "typescript";

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

/**
 * Extract identifiers from an expression string using TypeScript AST.
 * Returns a set of identifier names found in the expression, excluding:
 * - Function/arrow function parameters
 * - Property names in object literals
 * - Property names in property access expressions (right side of dot)
 * - Built-in identifiers like 'gql'
 *
 * For property access chains like `foo.bar.baz`, extracts:
 * - "foo" (root identifier)
 * - "foo.bar"
 * - "foo.bar.baz"
 */
const extractIdentifiersFromExpression = (expression: string): Set<string> => {
  const identifiers = new Set<string>();
  const excluded = new Set<string>(["gql"]);
  const sourceFile = ts.createSourceFile("temp.ts", expression, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  // Resolve property access chain to get root and segments
  const resolvePropertyAccess = (
    expr: ts.Expression,
  ): { root: string; segments: string[] } | null => {
    const segments: string[] = [];
    let current: ts.Expression = expr;

    while (ts.isPropertyAccessExpression(current)) {
      segments.unshift(current.name.text);
      current = current.expression;
    }

    if (ts.isIdentifier(current)) {
      return { root: current.text, segments };
    }

    return null;
  };

  const visit = (node: ts.Node, localExclusions: Set<string>) => {
    // Handle function-like nodes to track parameter names
    if (ts.isFunctionLike(node) && node.parameters) {
      const nextExclusions = new Set(localExclusions);
      node.parameters.forEach((param) => {
        if (ts.isIdentifier(param.name)) {
          nextExclusions.add(param.name.text);
        }
      });
      // Visit function body with updated exclusions
      if (node.body) {
        visit(node.body, nextExclusions);
      }
      return;
    }

    // Handle property access expressions
    if (ts.isPropertyAccessExpression(node)) {
      const resolved = resolvePropertyAccess(node);
      if (resolved) {
        const { root, segments } = resolved;
        if (!excluded.has(root) && !localExclusions.has(root)) {
          // Add root identifier
          identifiers.add(root);
          // Add each segment combination
          for (let i = 0; i < segments.length; i++) {
            const path = `${root}.${segments.slice(0, i + 1).join(".")}`;
            identifiers.add(path);
          }
        }
      }
      // Don't visit children as we've already processed the entire chain
      return;
    }

    // Handle standalone identifiers
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      // Skip property names in various contexts
      if (parent) {
        if (ts.isPropertyAssignment(parent) && parent.name === node) {
          return;
        }
        if (ts.isPropertyAccessExpression(parent)) {
          // Already handled by property access logic above
          return;
        }
        if (ts.isMethodDeclaration(parent) && parent.name === node) {
          return;
        }
        if (ts.isParameter(parent) && parent.name === node) {
          return;
        }
      }

      const name = node.text;
      if (!excluded.has(name) && !localExclusions.has(name)) {
        identifiers.add(name);
      }
      return;
    }

    // Recursively visit children
    ts.forEachChild(node, (child) => visit(child, localExclusions));
  };

  visit(sourceFile, new Set());
  return identifiers;
};

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

      // Extract identifiers from the expression
      const identifiers = extractIdentifiersFromExpression(definition.expression);

      // Resolve each identifier to a canonical ID using the reference map
      identifiers.forEach((identifier) => {
        const canonical = referenceMap.get(identifier);
        if (canonical && canonical !== id) {
          dependencySet.add(canonical);
          resolvedReferences[identifier] = canonical;
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
