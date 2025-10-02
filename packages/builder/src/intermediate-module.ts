import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { AnyModel, AnyOperationOf, AnyOperationSliceOf, IssueRegistry, OperationType } from "@soda-gql/core";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { ModuleImport } from "./ast/analyze-module";
import type { DependencyGraph, DependencyGraphNode, ModuleSummary } from "./dependency-graph";
import type { BuilderError } from "./types";

export type IntermediateModule = {
  readonly models: Record<string, AnyModel>;
  readonly slices: Record<string, AnyOperationSliceOf<OperationType>>;
  readonly operations: Record<string, AnyOperationOf<OperationType>>;
  readonly issueRegistry: IssueRegistry;
};

const formatFactory = (expression: string): string => {
  const trimmed = expression.trim();
  if (!trimmed.includes("\n")) {
    return trimmed;
  }

  const lines = trimmed.split("\n").map((line) => line.trimEnd());
  const indented = lines.map((line, index) => (index === 0 ? line : `    ${line}`)).join("\n");

  return `(\n    ${indented}\n  )`;
};

type FileGroup = {
  readonly filePath: string;
  readonly nodes: DependencyGraphNode[];
};

const groupNodesByFile = (graph: DependencyGraph): FileGroup[] => {
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

type TreeNode = {
  expression?: string; // Leaf node with actual expression
  children: Map<string, TreeNode>; // Branch node with children
};

const buildTree = (nodes: DependencyGraphNode[]): Map<string, TreeNode> => {
  const roots = new Map<string, TreeNode>();

  nodes.forEach((node) => {
    const parts = node.localPath.split(".");
    const expressionText = node.definition.expression.trim();

    if (parts.length === 1) {
      // Top-level export
      const rootName = parts[0];
      if (rootName) {
        roots.set(rootName, {
          expression: expressionText,
          children: new Map(),
        });
      }
    } else {
      // Nested export
      const rootName = parts[0];
      if (!rootName) return;

      let root = roots.get(rootName);
      if (!root) {
        root = { children: new Map() };
        roots.set(rootName, root);
      }

      let current = root;
      for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;

        let child = current.children.get(part);
        if (!child) {
          child = { children: new Map() };
          current.children.set(part, child);
        }
        current = child;
      }

      const leafName = parts[parts.length - 1];
      if (leafName) {
        current.children.set(leafName, {
          expression: expressionText,
          children: new Map(),
        });
      }
    }
  });

  return roots;
};

const renderTreeNode = (node: TreeNode, indent: number): string => {
  if (node.expression && node.children.size === 0) {
    // Leaf node - render the expression directly
    return formatFactory(node.expression);
  }

  // Branch node - render nested object
  const indentStr = "  ".repeat(indent);
  const entries = Array.from(node.children.entries()).map(([key, child]) => {
    const value = renderTreeNode(child, indent + 1);
    return `${indentStr}  ${key}: ${value},`;
  });

  if (entries.length === 0) {
    return "{}";
  }

  return `{\n${entries.join("\n")}\n${indentStr}}`;
};

const buildNestedObject = (nodes: DependencyGraphNode[]): string => {
  const tree = buildTree(nodes);
  const declarations: string[] = [];
  const returnEntries: string[] = [];

  tree.forEach((node, rootName) => {
    if (node.children.size > 0) {
      // Has children - create a const declaration
      const objectLiteral = renderTreeNode(node, 2);
      declarations.push(`    const ${rootName} = ${objectLiteral};`);
      returnEntries.push(rootName);
    } else if (node.expression) {
      // Single export - can be inlined or declared
      const expr = formatFactory(node.expression);
      declarations.push(`    const ${rootName} = ${expr};`);
      returnEntries.push(rootName);
    }
  });

  const returnStatement =
    returnEntries.length > 0
      ? `    return {\n${returnEntries.map((name) => `        ${name},`).join("\n")}\n    };`
      : "    return {};";

  if (declarations.length === 0) {
    return returnStatement;
  }

  return `${declarations.join("\n")}\n${returnStatement}`;
};

/**
 * Get map of file paths to their module summaries from the graph.
 */
const getModuleSummaries = (graph: DependencyGraph): Map<string, ModuleSummary> => {
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
const normalizePath = (value: string): string => {
  return value.replace(/\\/g, "/");
};

/**
 * Resolve a module specifier to an absolute file path.
 */
const resolveImportPath = (currentFilePath: string, specifier: string, summaries: Map<string, ModuleSummary>): string | null => {
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
 * Render import statements for the intermediate module using ModuleSummary.
 * Only includes imports from modules that have gql exports.
 */
const renderImportStatements = (
  summary: ModuleSummary,
  summaries: Map<string, ModuleSummary>,
): { imports: string; importedRootNames: Set<string>; namespaceImports: Set<string> } => {
  const importLines: string[] = [];
  const importedRootNames = new Set<string>();
  const namespaceImports = new Set<string>();

  // Group imports by resolved file path
  const importsByFile = new Map<string, ModuleImport[]>();

  summary.runtimeImports.forEach((imp) => {
    // Skip non-relative imports (external packages)
    if (!imp.source.startsWith(".")) {
      return;
    }

    const resolvedPath = resolveImportPath(summary.filePath, imp.source, summaries);
    if (!resolvedPath) {
      return;
    }

    const targetSummary = summaries.get(resolvedPath);
    if (!targetSummary) {
      return;
    }

    // Only include imports from modules with gql exports
    if (targetSummary.gqlExports.length === 0) {
      return;
    }

    const imports = importsByFile.get(resolvedPath) ?? [];
    imports.push(imp);
    importsByFile.set(resolvedPath, imports);
  });

  // Render registry.import() for each file
  importsByFile.forEach((imports, filePath) => {
    // Check if this is a namespace import
    const namespaceImport = imports.find((imp) => imp.kind === "namespace");

    if (namespaceImport) {
      // Namespace import: const foo = registry.import("path");
      importLines.push(`    const ${namespaceImport.local} = registry.import("${filePath}");`);
      namespaceImports.add(namespaceImport.local);
      importedRootNames.add(namespaceImport.local);
    } else {
      // Named imports: const { a, b } = registry.import("path");
      const rootNames = new Set<string>();

      imports.forEach((imp) => {
        if (imp.kind === "named" || imp.kind === "default") {
          rootNames.add(imp.local);
          importedRootNames.add(imp.local);
        }
      });

      if (rootNames.size > 0) {
        const destructured = Array.from(rootNames).sort().join(", ");
        importLines.push(`    const { ${destructured} } = registry.import("${filePath}");`);
      }
    }
  });

  return {
    imports: importLines.length > 0 ? `\n${importLines.join("\n")}\n` : "",
    importedRootNames,
    namespaceImports,
  };
};

const renderRegistryBlock = (fileGroup: FileGroup, summaries: Map<string, ModuleSummary>): string => {
  const { filePath, nodes } = fileGroup;

  // Get the module summary for this file
  const summary = summaries.get(filePath);
  if (!summary) {
    // Fallback: create empty summary
    const emptySummary: ModuleSummary = {
      filePath,
      runtimeImports: [],
      gqlExports: [],
    };
    const { imports } = renderImportStatements(emptySummary, summaries);
    const body = buildNestedObject(nodes);
    return `registry.register("${filePath}", () => {${imports}\n${body}\n});`;
  }

  const { imports } = renderImportStatements(summary, summaries);
  const body = buildNestedObject(nodes);

  return `registry.register("${filePath}", () => {${imports}\n${body}\n});`;
};

export type CreateIntermediateModuleInput = {
  readonly graph: DependencyGraph;
  readonly outDir: string;
};

export const createIntermediateModule = async ({
  graph,
  outDir,
}: CreateIntermediateModuleInput): Promise<Result<{ transpiledPath: string; sourceCode: string }, BuilderError>> => {
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: outDir,
    });
  }

  const missing: DependencyGraphNode[] = [];

  graph.forEach((node) => {
    if (!node.definition.expression || node.definition.expression.trim().length === 0) {
      missing.push(node);
    }
  });

  if (missing.length > 0) {
    const [first] = missing;
    const filePath = first?.filePath ?? outDir;
    const astPath = first?.definition.astPath ?? "";
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath,
      astPath,
      message: "MISSING_EXPRESSION",
    });
  }

  const summaries = getModuleSummaries(graph);
  const fileGroups = groupNodesByFile(graph);
  const registryBlocks = fileGroups.map((group) => renderRegistryBlock(group, summaries));

  const fileName = `intermediate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const jsFilePath = join(outDir, `${fileName}.mjs`);

  // Infer workspace root from the first node's file path in the graph
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

  const graphqlSystemIndex = join(workspaceRoot, "graphql-system", "index.ts");
  let gqlImportPath = "@/graphql-system";

  if (existsSync(graphqlSystemIndex)) {
    const relativePath = relative(dirname(jsFilePath), graphqlSystemIndex).replace(/\\/g, "/");
    let sanitized = relativePath.length > 0 ? relativePath : "./index.ts";
    if (!sanitized.startsWith(".")) {
      sanitized = `./${sanitized}`;
    }
    gqlImportPath = sanitized.endsWith(".ts") ? sanitized.slice(0, -3) : sanitized;
  }

  const imports = [
    `import { gql } from "${gqlImportPath}";`,
    `import { createPseudoModuleRegistry, createIssueRegistry, setActiveRegistry } from "@soda-gql/core";`,
  ];

  const registrySection = `// Initialize issue registry for build-time validation
export const issueRegistry = createIssueRegistry();
setActiveRegistry(issueRegistry);`;

  const pseudoRegistrySection = `const registry = createPseudoModuleRegistry();`;

  const registryBlocksSection = registryBlocks.join("\n\n");

  const evaluationSection = `export const { models, slices, operations } = registry.evaluate();`;

  const sourceCode = `${imports.join("\n")}\n\n${registrySection}\n\n${pseudoRegistrySection}\n\n${registryBlocksSection}\n\n${evaluationSection}\n`;

  // Transpile TypeScript to JavaScript using SWC
  let transpiledCode: string;
  try {
    const result = transformSync(sourceCode, {
      filename: `${fileName}.ts`,
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: false,
        },
        target: "es2022",
      },
      module: {
        type: "es6",
      },
      sourceMaps: false,
      minify: false,
    });
    transpiledCode = result.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: jsFilePath,
      astPath: "",
      message: `SWC transpilation failed: ${message}`,
    });
  }

  try {
    await Bun.write(jsFilePath, transpiledCode);
    return ok({ transpiledPath: jsFilePath, sourceCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: jsFilePath,
    });
  }
};
