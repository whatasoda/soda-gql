import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DependencyGraph, DependencyGraphNode, ModuleSummary } from "../dependency-graph";

export type FileGroup = {
  readonly filePath: string;
  readonly nodes: DependencyGraphNode[];
};

export type GraphAnalysisResult = {
  readonly fileGroups: FileGroup[];
  readonly summaries: Map<string, ModuleSummary>;
  readonly missingExpressions: DependencyGraphNode[];
  readonly workspaceRoot: string;
};

/**
 * Group dependency graph nodes by file path.
 */
export const groupNodesByFile = (graph: DependencyGraph): FileGroup[] => {
  const fileMap = new Map<string, DependencyGraphNode[]>();

  graph.forEach((node) => {
    const nodes = fileMap.get(node.filePath) ?? [];
    nodes.push(node);
    fileMap.set(node.filePath, nodes);
  });

  return Array.from(fileMap.entries())
    .map(([filePath, nodes]) => ({ filePath, nodes }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
};

/**
 * Get map of file paths to their module summaries from the graph.
 */
export const getModuleSummaries = (graph: DependencyGraph): Map<string, ModuleSummary> => {
  const summaries = new Map<string, ModuleSummary>();

  graph.forEach((node) => {
    const { filePath } = node.moduleSummary;
    if (!summaries.has(filePath)) {
      summaries.set(filePath, node.moduleSummary);
    }
  });

  return summaries;
};

/**
 * Normalize path for consistent comparison.
 */
export const normalizePath = (value: string): string => {
  return value.replace(/\\/g, "/");
};

/**
 * Resolve a module specifier to an absolute file path.
 */
export const resolveImportPath = (
  currentFilePath: string,
  specifier: string,
  summaries: Map<string, ModuleSummary>,
): string | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = normalizePath(resolve(dirname(currentFilePath), specifier));
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
    const normalized = normalizePath(candidate);
    if (summaries.has(normalized)) {
      return normalized;
    }
  }

  return null;
};

/**
 * Find missing expressions in the dependency graph.
 */
const findMissingExpressions = (graph: DependencyGraph): DependencyGraphNode[] => {
  const missing: DependencyGraphNode[] = [];

  graph.forEach((node) => {
    if (!node.definition.expression || node.definition.expression.trim().length === 0) {
      missing.push(node);
    }
  });

  return missing;
};

/**
 * Find workspace root by looking for graphql-system directory.
 * Walks up the directory tree from the first node's file path.
 */
export const findWorkspaceRoot = (graph: DependencyGraph): string => {
  let workspaceRoot = process.cwd();
  const firstNode = graph.values().next().value as DependencyGraphNode | undefined;

  if (firstNode) {
    let current = dirname(resolve(firstNode.filePath));
    // Walk up until we find graphql-system directory
    while (current !== dirname(current)) {
      const graphqlSystemPath = join(current, "graphql-system", "index.ts");
      if (existsSync(graphqlSystemPath)) {
        workspaceRoot = current;
        break;
      }
      current = dirname(current);
    }
  }

  return workspaceRoot;
};

/**
 * Analyze the dependency graph and extract all necessary information
 * for code generation.
 */
export const analyzeGraph = (graph: DependencyGraph): GraphAnalysisResult => {
  return {
    fileGroups: groupNodesByFile(graph),
    summaries: getModuleSummaries(graph),
    missingExpressions: findMissingExpressions(graph),
    workspaceRoot: findWorkspaceRoot(graph),
  };
};
