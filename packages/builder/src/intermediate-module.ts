import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { AnyModel, AnyOperationOf, AnyOperationSliceOf, IssueRegistry, OperationType } from "@soda-gql/core";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { DependencyGraph, DependencyGraphNode } from "./dependency-graph";
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

type DependencyBinding = {
  readonly symbol: string;
  readonly localName: string;
  readonly canonicalId: string;
  readonly filePath: string;
  readonly exportPath: string;
};

const splitCanonicalId = (canonicalId: string): { filePath: string; exportPath: string } => {
  const [filePath, exportPath] = canonicalId.split("::");
  return { filePath: filePath ?? "", exportPath: exportPath ?? "" };
};

const groupNodesByFile = (graph: DependencyGraph): FileGroup[] => {
  const fileMap = new Map<string, DependencyGraphNode[]>();

  graph.forEach((node) => {
    const { filePath } = splitCanonicalId(node.id);
    const nodes = fileMap.get(filePath) ?? [];
    nodes.push(node);
    fileMap.set(filePath, nodes);
  });

  return Array.from(fileMap.entries())
    .map(([filePath, nodes]) => ({ filePath, nodes }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
};

const createLocalName = (exportPath: string): string => {
  return exportPath.replace(/\./g, "_");
};

const analyzeDependencies = (
  node: DependencyGraphNode,
  currentFilePath: string,
  graph: DependencyGraph,
): { crossFile: Map<string, DependencyBinding[]>; sameFile: DependencyBinding[] } => {
  const crossFileMap = new Map<string, DependencyBinding[]>();
  const sameFile: DependencyBinding[] = [];

  Object.entries(node.references).forEach(([symbol, canonicalId]) => {
    const target = graph.get(canonicalId);
    if (!target) {
      return;
    }

    const { filePath, exportPath } = splitCanonicalId(canonicalId);
    const localName = createLocalName(exportPath);
    const binding: DependencyBinding = { symbol, localName, canonicalId, filePath, exportPath };

    if (filePath === currentFilePath) {
      sameFile.push(binding);
    } else {
      const bindings = crossFileMap.get(filePath) ?? [];
      bindings.push(binding);
      crossFileMap.set(filePath, bindings);
    }
  });

  return { crossFile: crossFileMap, sameFile };
};

type TreeNode = {
  expression?: string; // Leaf node with actual expression
  children: Map<string, TreeNode>; // Branch node with children
};

const buildTree = (nodes: DependencyGraphNode[]): Map<string, TreeNode> => {
  const roots = new Map<string, TreeNode>();

  nodes.forEach((node) => {
    const { exportPath } = splitCanonicalId(node.id);
    const parts = exportPath.split(".");
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

const renderImportStatements = (
  nodes: DependencyGraphNode[],
  currentFilePath: string,
  graph: DependencyGraph,
): { imports: string; importedRootNames: Set<string>; namespaceImports: Set<string> } => {
  const allCrossFileDeps = new Map<string, Set<DependencyBinding>>();

  nodes.forEach((node) => {
    const { crossFile } = analyzeDependencies(node, currentFilePath, graph);
    crossFile.forEach((bindings, filePath) => {
      const existing = allCrossFileDeps.get(filePath) ?? new Set();
      bindings.forEach((binding) => {
        existing.add(binding);
      });
      allCrossFileDeps.set(filePath, existing);
    });
  });

  const importLines: string[] = [];
  const importedRootNames = new Set<string>();
  const namespaceImports = new Set<string>();

  allCrossFileDeps.forEach((bindings, filePath) => {
    // Detect if this is a namespace import
    // A namespace import is when all symbols share the same root prefix that's not in exportPath
    const bindingsArray = Array.from(bindings);

    // Check if all bindings share a common namespace prefix
    let commonNamespace: string | null = null;
    let isNamespaceImport = false;

    if (bindingsArray.length > 0) {
      // Get the first symbol's potential namespace (first segment before first dot)
      const firstSymbol = bindingsArray[0]?.symbol;
      if (firstSymbol?.includes(".")) {
        const potentialNamespace = firstSymbol.split(".")[0];

        // Check if all symbols start with this namespace
        const allShareNamespace = bindingsArray.every((binding) => {
          return binding.symbol.startsWith(`${potentialNamespace}.`);
        });

        // Check if the namespace doesn't match any exportPath root
        const namespaceNotInExports = bindingsArray.every((binding) => {
          const exportRoot = binding.exportPath.split(".")[0];
          return exportRoot !== potentialNamespace;
        });

        if (allShareNamespace && namespaceNotInExports && potentialNamespace) {
          commonNamespace = potentialNamespace;
          isNamespaceImport = true;
        }
      }
    }

    if (isNamespaceImport && commonNamespace) {
      // Namespace import: const foo = registry.import("path");
      importLines.push(`    const ${commonNamespace} = registry.import("${filePath}");`);
      namespaceImports.add(commonNamespace);
      importedRootNames.add(commonNamespace);
    } else {
      // Named import: const { a, b } = registry.import("path");
      const rootNames = new Set<string>();
      bindings.forEach((binding) => {
        const parts = binding.exportPath.split(".");
        const rootName = parts[0];
        if (rootName) {
          rootNames.add(rootName);
          importedRootNames.add(rootName);
        }
      });

      const destructured = Array.from(rootNames).sort().join(", ");
      importLines.push(`    const { ${destructured} } = registry.import("${filePath}");`);
    }
  });

  return {
    imports: importLines.length > 0 ? `\n${importLines.join("\n")}\n` : "",
    importedRootNames,
    namespaceImports,
  };
};

const renderAliasBindings = (
  nodes: DependencyGraphNode[],
  currentFilePath: string,
  graph: DependencyGraph,
  importedRootNames: Set<string>,
  namespaceImports: Set<string>,
): string => {
  // Collect simple aliases and namespace aliases separately
  const simpleAliases = new Map<string, string>();
  const namespaceAliases = new Map<string, Map<string, string>>();

  nodes.forEach((node) => {
    const { crossFile } = analyzeDependencies(node, currentFilePath, graph);

    const processBinding = (binding: DependencyBinding) => {
      const parts = binding.symbol.split(".");

      if (parts.length === 1) {
        // Simple identifier - direct alias
        if (binding.symbol !== binding.exportPath) {
          simpleAliases.set(binding.symbol, binding.exportPath);
        }
      } else if (parts.length > 1) {
        // Namespace import like userCatalog.collections.byCategory
        const namespace = parts[0];
        const property = parts[1];
        if (!namespace || !property) return;

        // Skip if namespace was imported as a whole (star import)
        if (namespaceImports.has(namespace)) {
          return;
        }

        // Skip if namespace is already imported as a root name
        // (the imported object already has the correct structure)
        if (importedRootNames.has(namespace)) {
          return;
        }

        // Get or create namespace map
        let nsMap = namespaceAliases.get(namespace);
        if (!nsMap) {
          nsMap = new Map();
          namespaceAliases.set(namespace, nsMap);
        }

        // Map property to the root of the export path
        const exportRoot = binding.exportPath.split(".")[0];
        if (exportRoot) {
          nsMap.set(property, exportRoot);
        }
      }
    };

    // Only process cross-file dependencies for aliases
    // Same-file dependencies don't need aliases because we recreate the original export structure
    crossFile.forEach((bindings) => {
      bindings.forEach(processBinding);
    });
  });

  const lines: string[] = [];

  // Emit simple aliases first
  if (simpleAliases.size > 0) {
    const sorted = Array.from(simpleAliases.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sorted.forEach(([symbol, exportPath]) => {
      lines.push(`    const ${symbol} = ${exportPath};`);
    });
  }

  // Emit namespace aliases as object literals
  if (namespaceAliases.size > 0) {
    const sortedNamespaces = Array.from(namespaceAliases.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sortedNamespaces.forEach(([namespace, properties]) => {
      const sortedProps = Array.from(properties.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const propsStr = sortedProps
        .map(([prop, target]) => {
          return prop === target ? prop : `${prop}: ${target}`;
        })
        .join(", ");
      lines.push(`    const ${namespace} = { ${propsStr} };`);
    });
  }

  return lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
};

const renderRegistryBlock = (fileGroup: FileGroup, graph: DependencyGraph): string => {
  const { filePath, nodes } = fileGroup;
  const { imports, importedRootNames, namespaceImports } = renderImportStatements(nodes, filePath, graph);
  const aliases = renderAliasBindings(nodes, filePath, graph, importedRootNames, namespaceImports);
  const body = buildNestedObject(nodes);

  return `registry.register("${filePath}", () => {${imports}${aliases}\n${body}\n});`;
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
    const filePath = first ? (first.id.split("::")[0] ?? first.id) : outDir;
    const exportName = first?.definition.exportName ?? "";
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath,
      exportName,
      message: "MISSING_EXPRESSION",
    });
  }

  const fileGroups = groupNodesByFile(graph);
  const registryBlocks = fileGroups.map((group) => renderRegistryBlock(group, graph));

  const fileName = `intermediate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const jsFilePath = join(outDir, `${fileName}.mjs`);

  // Infer workspace root from the first canonical ID in the graph
  let workspaceRoot = process.cwd();
  const firstNode = graph.values().next().value as DependencyGraphNode | undefined;
  if (firstNode) {
    const firstFilePath = firstNode.id.split("::")[0];
    if (firstFilePath) {
      let current = dirname(resolve(firstFilePath));
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
      exportName: "",
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
