import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { err, ok, type Result } from "neverthrow";
import ts from "typescript";

import type { DependencyGraph, DependencyGraphNode } from "./dependency-graph";
import { createRuntimeBindingName, createRuntimeDocumentName } from "./runtime-names";
import type { BuilderError } from "./types";

const createRuntimePlaceholder = (fn: ts.ArrowFunction | ts.FunctionExpression) => {
  const returnStatement = ts.factory.createReturnStatement(ts.factory.createObjectLiteralExpression([], false));
  const commentedReturn = ts.addSyntheticLeadingComment(
    returnStatement,
    ts.SyntaxKind.MultiLineCommentTrivia,
    " runtime function ",
    true,
  );
  const block = ts.factory.createBlock([commentedReturn], true);

  if (ts.isArrowFunction(fn)) {
    return ts.factory.updateArrowFunction(fn, fn.modifiers, [], [], undefined, fn.equalsGreaterThanToken, block);
  }

  return ts.factory.updateFunctionExpression(fn, fn.modifiers, undefined, fn.name, [], [], undefined, block);
};

const _indentLines = (value: string, indent: string): string =>
  value
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join("\n");

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

  const shouldReplaceTransform = (
    expression: ts.Expression | undefined,
  ): expression is ts.ArrowFunction | ts.FunctionExpression =>
    Boolean(expression && (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)));

  const maybeSanitizeTransform = (call: ts.CallExpression): ts.CallExpression => {
    if (!ts.isPropertyAccessExpression(call.expression)) {
      return call;
    }

    const method = call.expression.name.text;
    const args = [...call.arguments];

    const replaceTransformAt = (index: number) => {
      const candidate = args[index];
      if (shouldReplaceTransform(candidate)) {
        args[index] = createRuntimePlaceholder(candidate);
      }
    };

    if (method === "model" && args.length >= 3) {
      replaceTransformAt(2);
    }

    if (args.every((arg, index) => arg === call.arguments[index])) {
      return call;
    }

    return ts.factory.updateCallExpression(call, call.expression, call.typeArguments, args);
  };

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const sanitizeSelectResolver = (fn: ts.ArrowFunction | ts.FunctionExpression) => {
      let changed = false;

      const transformNode = (node: ts.Node): ts.Node => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          const isSelectCall =
            (ts.isPropertyAccessExpression(callee) && callee.name.text === "select") ||
            (ts.isIdentifier(callee) && callee.text === "select");

          if (isSelectCall) {
            const args = [...node.arguments];
            if (args.length >= 2 && shouldReplaceTransform(args[1])) {
              args[1] = createRuntimePlaceholder(args[1]);
              changed = true;
              if (ts.isPropertyAccessExpression(callee)) {
                return ts.factory.updateCallExpression(node, callee, node.typeArguments, args);
              }
              return ts.factory.updateCallExpression(node, callee, node.typeArguments, args);
            }
          }
        }

        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "select"
        ) {
          const args = [...node.arguments];
          if (args.length >= 2 && shouldReplaceTransform(args[1])) {
            args[1] = createRuntimePlaceholder(args[1]);
            changed = true;
            return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, args);
          }
        }

        return ts.visitEachChild(node, transformNode, context);
      };

      let newBody: ts.ConciseBody = fn.body;
      if (ts.isBlock(fn.body)) {
        const statements = fn.body.statements.map((statement) => transformNode(statement) as ts.Statement);
        if (changed) {
          newBody = ts.factory.updateBlock(fn.body, statements);
        }
      } else {
        const expressionBody = transformNode(fn.body) as ts.Expression;
        if (changed) {
          newBody = expressionBody;
        }
      }

      if (!changed) {
        return fn;
      }

      if (ts.isArrowFunction(fn)) {
        return ts.factory.updateArrowFunction(
          fn,
          fn.modifiers,
          fn.typeParameters,
          fn.parameters,
          fn.type,
          fn.equalsGreaterThanToken,
          newBody,
        );
      }

      return ts.factory.updateFunctionExpression(
        fn,
        fn.modifiers,
        fn.asteriskToken,
        fn.name,
        fn.typeParameters,
        fn.parameters,
        fn.type,
        newBody as ts.Block,
      );
    };

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

      if (ts.isCallExpression(node)) {
        const updated = maybeSanitizeTransform(node);
        if (updated !== node) {
          return ts.visitEachChild(updated, visit, context);
        }

        if (ts.isPropertyAccessExpression(node.expression)) {
          const calleeName = node.expression.name.text;
          if (calleeName === "querySlice" || calleeName === "mutationSlice" || calleeName === "subscriptionSlice") {
            const args = [...node.arguments];
            const resolver = args[2];
            if (resolver && shouldReplaceTransform(resolver)) {
              const sanitized = sanitizeSelectResolver(resolver);
              if (sanitized !== resolver) {
                args[2] = sanitized;
                return ts.visitEachChild(
                  ts.factory.updateCallExpression(node, node.expression, node.typeArguments, args),
                  visit,
                  context,
                );
              }
            }
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

  if (!transformedFile) {
    transformed.dispose();
    throw new Error("RUNTIME_MODULE_TRANSFORM_FAILURE");
  }

  const expressionStatement = transformedFile.statements[0];

  if (!expressionStatement || !ts.isExpressionStatement(expressionStatement)) {
    transformed.dispose();
    throw new Error("RUNTIME_MODULE_TRANSFORM_FAILURE");
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  let printed = printer.printNode(ts.EmitHint.Expression, expressionStatement.expression, transformedFile).trim();

  if (printed.startsWith("(") && printed.endsWith(")")) {
    printed = printed.slice(1, -1).trim();
  }

  transformed.dispose();

  return printed;
};

type ReplacementEntry = {
  readonly prefix: "models" | "slices" | "operations";
  readonly canonicalId: string;
};

const createReplacementMap = (node: DependencyGraphNode, graph: DependencyGraph): Map<string, ReplacementEntry> => {
  const map = new Map<string, ReplacementEntry>();

  Object.entries(node.references).forEach(([symbol, canonicalId]) => {
    const target = graph.get(canonicalId);
    if (!target) {
      return;
    }

    const accessorPrefix =
      target.definition.kind === "model" ? "models" : target.definition.kind === "slice" ? "slices" : "operations";

    map.set(symbol, { prefix: accessorPrefix, canonicalId });
  });

  return map;
};

const renderEntry = (node: DependencyGraphNode, graph: DependencyGraph): string => {
  const expressionText = node.definition.expression.trim();
  const replacements = createReplacementMap(node, graph);
  const rewritten = rewriteExpression(expressionText, replacements);
  const normalized = node.definition.kind === "model" ? replaceModelTransform(rewritten) : rewritten;
  const factory = formatFactory(normalized);

  return `  "${node.id}": ${factory},`;
};

const replaceModelTransform = (expression: string): string => {
  const target = expression.trimStart();
  if (!target.startsWith("gql.model")) {
    return expression;
  }

  const sourceText = `(${expression})`;
  const sourceFile = ts.createSourceFile("model.ts", sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "model") {
        const args = [...node.arguments];
        const thirdArg = args[2];
        if (args.length >= 3 && thirdArg && (ts.isArrowFunction(thirdArg) || ts.isFunctionExpression(thirdArg))) {
          args[2] = createRuntimePlaceholder(thirdArg);
          return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, args);
        }
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitEachChild(node, visit, context);
  };

  const transformed = ts.transform(sourceFile, [transformer]);
  const [transformedFile] = transformed.transformed;

  if (!transformedFile) {
    transformed.dispose();
    return expression;
  }

  const expressionStatement = transformedFile.statements[0];

  if (!expressionStatement || !ts.isExpressionStatement(expressionStatement)) {
    transformed.dispose();
    return expression;
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  let printed = printer.printNode(ts.EmitHint.Expression, expressionStatement.expression, transformedFile).trim();

  if (printed.startsWith("(") && printed.endsWith(")")) {
    printed = printed.slice(1, -1).trim();
  }

  transformed.dispose();

  return printed;
};

const renderSection = (label: string, entries: readonly string[]): string => {
  if (entries.length === 0) {
    return `export const ${label} = {} as const;`;
  }

  const body = entries.join("\n");
  return `export const ${label} = {\n${body}\n} as const;`;
};

export type CreateRuntimeModuleInput = {
  readonly graph: DependencyGraph;
  readonly outDir: string;
};

export const createRuntimeModule = async ({ graph, outDir }: CreateRuntimeModuleInput): Promise<Result<string, BuilderError>> => {
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

  const models: string[] = [];
  const slices: string[] = [];
  const operations: string[] = [];
  const missing: DependencyGraphNode[] = [];
  const namedExportEntries: Array<{
    readonly accessor: "models" | "slices" | "operations";
    readonly name: string;
    readonly canonicalId: string;
  }> = [];
  const documentExports: Array<{ readonly name: string; readonly canonicalId: string }> = [];
  const usedExportNames = new Map<string, string>();
  let exportCollision: { readonly name: string; readonly existing: string; readonly incoming: string } | null = null;

  graph.forEach((node) => {
    if (!node.definition.expression || node.definition.expression.trim().length === 0) {
      missing.push(node);
      return;
    }
    const entry = renderEntry(node, graph);
    const runtimeBindingName = createRuntimeBindingName(node.id, node.definition.exportName);

    const previous = usedExportNames.get(runtimeBindingName);
    if (previous && previous !== node.id && exportCollision === null) {
      exportCollision = { name: runtimeBindingName, existing: previous, incoming: node.id };
    } else {
      usedExportNames.set(runtimeBindingName, node.id);
    }

    const accessor = node.definition.kind === "model" ? "models" : node.definition.kind === "slice" ? "slices" : "operations";
    namedExportEntries.push({ accessor, name: runtimeBindingName, canonicalId: node.id });

    if (node.definition.kind === "operation") {
      const documentName = createRuntimeDocumentName(node.id, node.definition.exportName);
      documentExports.push({ name: documentName, canonicalId: node.id });
    }

    switch (node.definition.kind) {
      case "model": {
        models.push(entry);
        break;
      }
      case "slice": {
        slices.push(entry);
        break;
      }
      case "operation": {
        operations.push(entry);
        break;
      }
      default:
        break;
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

  if (exportCollision) {
    // biome-ignore lint/suspicious/noExplicitAny: Type narrowing issue
    const filePath = (exportCollision as any).incoming.split("::")[0] ?? outDir;
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath,
      // biome-ignore lint/suspicious/noExplicitAny: Type narrowing issue
      exportName: (exportCollision as any).name,
      // biome-ignore lint/suspicious/noExplicitAny: Type narrowing issue
      message: `RUNTIME_EXPORT_NAME_COLLISION:${(exportCollision as any).existing}`,
    });
  }

  const sections = [renderSection("models", models), renderSection("slices", slices), renderSection("operations", operations)]
    .map((section) => section.trimEnd())
    .join("\n\n");

  const namedExports = namedExportEntries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `export const ${entry.name} = ${entry.accessor}["${entry.canonicalId}"];`)
    .join("\n");

  const operationDocumentExports = documentExports
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `export const ${entry.name} = operations["${entry.canonicalId}"].document;`)
    .join("\n");

  const exportSections = [namedExports, operationDocumentExports].filter((section) => section.length > 0).join("\n");

  const imports = [`import { gql } from "@/graphql-system";`];

  const content = `${imports.join("\n")}\n\n${sections}\n\n${exportSections}\n`;

  const fileName = `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.ts`;
  const filePath = join(outDir, fileName);

  try {
    await Bun.write(filePath, content);
    return ok(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: filePath,
    });
  }
};
