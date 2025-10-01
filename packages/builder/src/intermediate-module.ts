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

  // Cross-file dependencies use the local binding name
  crossFile.forEach((bindings) => {
    bindings.forEach(({ symbol, localName }) => {
      map.set(symbol, { expression: localName });
    });
  });

  // Same-file dependencies reference the local const directly
  sameFile.forEach(({ symbol, localName }) => {
    map.set(symbol, { expression: localName });
  });

  return map;
};

const buildNestedObject = (nodes: DependencyGraphNode[], currentFilePath: string, graph: DependencyGraph): string => {
  // Create local const declarations for each export
  const declarations: string[] = [];
  const exportPaths: string[] = [];

  nodes.forEach((node) => {
    const { exportPath } = splitCanonicalId(node.id);
    const localName = createLocalName(exportPath);
    const expressionText = node.definition.expression.trim();
    const replacements = createReplacementMap(node, currentFilePath, graph);
    const rewritten = rewriteExpression(expressionText, replacements);
    const factory = formatFactory(rewritten);

    declarations.push(`    const ${localName} = ${factory};`);
    exportPaths.push(exportPath);
  });

  // Build nested object structure
  const selfObj: Record<string, unknown> = {};

  nodes.forEach((node) => {
    const { exportPath } = splitCanonicalId(node.id);
    const localName = createLocalName(exportPath);
    const parts = exportPath.split(".");

    let current = selfObj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) {
        continue;
      }
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = localName;
    }
  });

  const renderObject = (obj: Record<string, unknown>, indent: number): string => {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return "{}";
    }

    const indentStr = "  ".repeat(indent);
    const lines = entries.map(([key, value]) => {
      if (typeof value === "string") {
        return `${indentStr}  ${key}: ${value},`;
      }
      return `${indentStr}  ${key}: ${renderObject(value as Record<string, unknown>, indent + 1)},`;
    });

    return `{\n${lines.join("\n")}\n${indentStr}}`;
  };

  const selfDeclaration = `    const self = ${renderObject(selfObj, 2)};`;

  return `${declarations.join("\n")}\n\n${selfDeclaration}\n    return self;`;
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
    const uniqueExports = new Map<string, string>();
    bindings.forEach((binding) => {
      uniqueExports.set(binding.exportPath, binding.localName);
    });

    const destructured = Array.from(uniqueExports.entries())
      .map(([exportPath, localName]) => {
        const parts = exportPath.split(".");
        if (parts.length === 1) {
          return exportPath === localName ? exportPath : `${exportPath}: ${localName}`;
        }
        // For nested paths, we need to access them from the imported module
        return `${parts[0]}`;
      })
      .filter((v, i, arr) => arr.indexOf(v) === i);

    importLines.push(`    const { ${destructured.join(", ")} } = registry.import("${filePath}");`);

    // Create additional bindings for nested exports
    uniqueExports.forEach((localName, exportPath) => {
      const parts = exportPath.split(".");
      if (parts.length > 1 && parts[0]) {
        importLines.push(`    const ${localName} = ${parts[0]}.${parts.slice(1).join(".")};`);
      }
    });
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
