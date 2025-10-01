import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { AnyModel, AnyOperationOf, AnyOperationSliceOf, IssueRegistry, OperationType } from "@soda-gql/core";
import { unwrapNullish } from "@soda-gql/tool-utils";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import ts from "typescript";
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

const getPropertyAccessPath = (node: ts.PropertyAccessExpression): string | null => {
  const segments: string[] = [];
  let current: ts.Expression = node;

  while (ts.isPropertyAccessExpression(current)) {
    segments.unshift(current.name.text);
    current = current.expression;
  }

  if (ts.isIdentifier(current)) {
    segments.unshift(current.text);
    return segments.join(".");
  }

  return null;
};

const rewriteExpression = (expression: string, replacements: Map<string, ReplacementEntry>): string => {
  if (replacements.size === 0) {
    return expression.trim();
  }

  const sourceText = `(${expression})`;
  const sourceFile = ts.createSourceFile("runtime-expression.ts", sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  const createReplacementExpression = (replacement: ReplacementEntry): ts.Expression => {
    const tempSource = ts.createSourceFile("temp.ts", replacement.expression, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const statement = tempSource.statements[0];
    if (statement && ts.isExpressionStatement(statement)) {
      return statement.expression;
    }
    // Fallback to identifier if parsing fails
    return ts.factory.createIdentifier(replacement.expression);
  };

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isPropertyAccessExpression(node)) {
        const path = getPropertyAccessPath(node);
        if (path) {
          const replacement = replacements.get(path);
          if (replacement) {
            return createReplacementExpression(replacement);
          }
        }
      }

      if (ts.isIdentifier(node)) {
        const parent = node.parent;
        if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
          return node;
        }

        const replacement = replacements.get(node.text);
        if (replacement) {
          return createReplacementExpression(replacement);
        }
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitEachChild(node, visit, context);
  };

  const transformed = ts.transform(sourceFile, [transformer]);
  const [transformedFile] = transformed.transformed;
  const expressionStatement = unwrapNullish(transformedFile, "safe-array-item-access").statements[0];

  if (!expressionStatement || !ts.isExpressionStatement(expressionStatement)) {
    transformed.dispose();
    throw new Error("RUNTIME_MODULE_TRANSFORM_FAILURE");
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  let printed = printer
    .printNode(ts.EmitHint.Expression, expressionStatement.expression, unwrapNullish(transformedFile, "safe-array-item-access"))
    .trim();

  if (printed.startsWith("(") && printed.endsWith(")")) {
    printed = printed.slice(1, -1).trim();
  }

  transformed.dispose();

  return printed;
};

type ReplacementEntry = {
  readonly expression: string;
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

const createReplacementMap = (
  node: DependencyGraphNode,
  currentFilePath: string,
  graph: DependencyGraph,
): Map<string, ReplacementEntry> => {
  const map = new Map<string, ReplacementEntry>();
  const { crossFile, sameFile } = analyzeDependencies(node, currentFilePath, graph);

  // Cross-file dependencies use property access from imported root
  crossFile.forEach((bindings) => {
    bindings.forEach(({ symbol, exportPath }) => {
      // Use property access notation: rootName.nested.path
      map.set(symbol, { expression: exportPath });
    });
  });

  // Same-file dependencies reference the root name with property access
  sameFile.forEach(({ symbol, exportPath }) => {
    // For same-file references, use the export path directly
    map.set(symbol, { expression: exportPath });
  });

  return map;
};

type TreeNode = {
  expression?: string; // Leaf node with actual expression
  children: Map<string, TreeNode>; // Branch node with children
};

const buildTree = (nodes: DependencyGraphNode[], currentFilePath: string, graph: DependencyGraph): Map<string, TreeNode> => {
  const roots = new Map<string, TreeNode>();

  nodes.forEach((node) => {
    const { exportPath } = splitCanonicalId(node.id);
    const parts = exportPath.split(".");
    const expressionText = node.definition.expression.trim();
    const replacements = createReplacementMap(node, currentFilePath, graph);
    const rewritten = rewriteExpression(expressionText, replacements);

    if (parts.length === 1) {
      // Top-level export
      const rootName = parts[0];
      if (rootName) {
        roots.set(rootName, {
          expression: rewritten,
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
          expression: rewritten,
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

const buildNestedObject = (nodes: DependencyGraphNode[], currentFilePath: string, graph: DependencyGraph): string => {
  const tree = buildTree(nodes, currentFilePath, graph);
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

const renderImportStatements = (nodes: DependencyGraphNode[], currentFilePath: string, graph: DependencyGraph): string => {
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

  allCrossFileDeps.forEach((bindings, filePath) => {
    // Extract only root names (first segment of export path)
    const rootNames = new Set<string>();
    bindings.forEach((binding) => {
      const parts = binding.exportPath.split(".");
      const rootName = parts[0];
      if (rootName) {
        rootNames.add(rootName);
      }
    });

    const destructured = Array.from(rootNames).sort().join(", ");
    importLines.push(`    const { ${destructured} } = registry.import("${filePath}");`);
  });

  return importLines.length > 0 ? `\n${importLines.join("\n")}\n` : "";
};

const renderRegistryBlock = (fileGroup: FileGroup, graph: DependencyGraph): string => {
  const { filePath, nodes } = fileGroup;
  const imports = renderImportStatements(nodes, filePath, graph);
  const body = buildNestedObject(nodes, filePath, graph);

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
