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

  const createAccessorExpression = (replacement: ReplacementEntry): ts.ElementAccessExpression =>
    ts.factory.createElementAccessExpression(
      ts.factory.createIdentifier(replacement.prefix),
      ts.factory.createStringLiteral(replacement.canonicalId),
    );

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isPropertyAccessExpression(node)) {
        const path = getPropertyAccessPath(node);
        if (path) {
          const replacement = replacements.get(path);
          if (replacement) {
            return createAccessorExpression(replacement);
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
          return createAccessorExpression(replacement);
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
  readonly prefix: "all";
  readonly canonicalId: string;
};

const createReplacementMap = (node: DependencyGraphNode, graph: DependencyGraph): Map<string, ReplacementEntry> => {
  const map = new Map<string, ReplacementEntry>();

  Object.entries(node.references).forEach(([symbol, canonicalId]) => {
    const target = graph.get(canonicalId);
    if (!target) {
      return;
    }

    map.set(symbol, { prefix: "all", canonicalId });
  });

  return map;
};

const renderEntry = (node: DependencyGraphNode, graph: DependencyGraph): string => {
  const expressionText = node.definition.expression.trim();
  const replacements = createReplacementMap(node, graph);
  const rewritten = rewriteExpression(expressionText, replacements);
  const factory = formatFactory(rewritten);

  return `  "${node.id}": ${factory},`;
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

  const entries: string[] = [];
  const missing: DependencyGraphNode[] = [];

  graph.forEach((node) => {
    if (!node.definition.expression || node.definition.expression.trim().length === 0) {
      missing.push(node);
      return;
    }
    const entry = renderEntry(node, graph);
    entries.push(entry);
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
    `import { evaluateBuilders, createIssueRegistry, setActiveRegistry } from "@soda-gql/core";`,
  ];

  const registrySection = `// Initialize issue registry for build-time validation
const registry = createIssueRegistry();
setActiveRegistry(registry);`;

  const allSection = `const all = {\n${entries.join("\n")}\n};`;

  const evaluationSection = `
export const { models, slices, operations } = evaluateBuilders(all);`;

  const registryExportSection = `export const issueRegistry = registry;`;

  const sourceCode = `${imports.join("\n")}\n\n${registrySection}\n\n${allSection}\n\n${evaluationSection}\n\n${registryExportSection}\n`;

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
