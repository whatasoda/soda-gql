import type { CanonicalPathTracker } from "@soda-gql/builder";
import { createCanonicalTracker } from "@soda-gql/builder";
import type * as ts from "typescript";

export type GqlDefinitionMetadata = {
  readonly astPath: string;
  readonly isTopLevel: boolean;
  readonly isExported: boolean;
  readonly exportBinding?: string;
};

export type GqlDefinitionMetadataMap = WeakMap<ts.CallExpression, GqlDefinitionMetadata>;

type CanonicalTrackerFactory = typeof createCanonicalTracker;

type CollectArgs = {
  readonly sourceFile: ts.SourceFile;
  readonly typescript: typeof ts;
  readonly filename: string;
  readonly createTracker?: CanonicalTrackerFactory;
};

type ScopeHandle = ReturnType<CanonicalPathTracker["enterScope"]>;
type ExportBindingMap = Map<string, string>;

export const collectGqlDefinitionMetadata = ({
  sourceFile,
  typescript,
  filename,
  createTracker,
}: CollectArgs): GqlDefinitionMetadataMap => {
  const exportBindings = collectExportBindings(sourceFile, typescript);
  const trackerFactory = createTracker ?? createCanonicalTracker;
  const tracker = trackerFactory({
    filePath: filename,
    getExportName: (localName) => exportBindings.get(localName),
  });

  const getAnonymousName = createAnonymousNameFactory();
  const scopeHandles = new WeakMap<ts.Node, ScopeHandle>();
  const metadata = new WeakMap<ts.CallExpression, GqlDefinitionMetadata>();

  const visit = (node: ts.Node): void => {
    // Handle GraphQL definition calls
    if (typescript.isCallExpression(node) && isGqlDefinitionCall(node, typescript)) {
      const depthBeforeRegister = tracker.currentDepth();
      const { astPath } = tracker.registerDefinition();
      const isTopLevel = depthBeforeRegister <= 1;
      const exportInfo = isTopLevel ? resolveTopLevelExport(node, exportBindings, typescript) : null;

      metadata.set(node, {
        astPath,
        isTopLevel,
        isExported: exportInfo?.isExported ?? false,
        exportBinding: exportInfo?.exportBinding,
      });

      // Skip visiting children of gql calls
      return;
    }

    // Enter scope if this node creates one
    const handle = maybeEnterScope(node, tracker, getAnonymousName, typescript);
    if (handle) {
      scopeHandles.set(node, handle);
    }

    // Visit children
    typescript.forEachChild(node, visit);

    // Exit scope if we entered one
    const scopeHandle = scopeHandles.get(node);
    if (scopeHandle) {
      tracker.exitScope(scopeHandle);
      scopeHandles.delete(node);
    }
  };

  visit(sourceFile);

  return metadata;
};

const collectExportBindings = (sourceFile: ts.SourceFile, typescript: typeof ts): ExportBindingMap => {
  const bindings: ExportBindingMap = new Map();

  for (const statement of sourceFile.statements) {
    // ESM exports: export const foo = ...
    if (
      typescript.isExportDeclaration(statement) &&
      statement.exportClause &&
      typescript.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const name = element.name.text;
        bindings.set(name, name);
      }
      continue;
    }

    // Export variable declaration: export const foo = ...
    if (
      typescript.isVariableStatement(statement) &&
      statement.modifiers?.some((m) => m.kind === typescript.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (typescript.isIdentifier(declaration.name)) {
          bindings.set(declaration.name.text, declaration.name.text);
        }
      }
      continue;
    }

    // Export function/class: export function foo() {} or export class Foo {}
    if (
      (typescript.isFunctionDeclaration(statement) || typescript.isClassDeclaration(statement)) &&
      statement.modifiers?.some((m) => m.kind === typescript.SyntaxKind.ExportKeyword) &&
      statement.name
    ) {
      bindings.set(statement.name.text, statement.name.text);
      continue;
    }

    // CommonJS exports: exports.foo = ... or module.exports.foo = ...
    if (typescript.isExpressionStatement(statement) && typescript.isBinaryExpression(statement.expression)) {
      const exportName = getCommonJsExportName(statement.expression.left, typescript);
      if (exportName) {
        bindings.set(exportName, exportName);
      }
    }
  }

  return bindings;
};

const getCommonJsExportName = (node: ts.Node, typescript: typeof ts): string | null => {
  if (!typescript.isPropertyAccessExpression(node)) {
    return null;
  }

  // Check if it's exports.foo or module.exports.foo
  const isExports = typescript.isIdentifier(node.expression) && node.expression.text === "exports";
  const isModuleExports =
    typescript.isPropertyAccessExpression(node.expression) &&
    typescript.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "module" &&
    typescript.isIdentifier(node.expression.name) &&
    node.expression.name.text === "exports";

  if (!isExports && !isModuleExports) {
    return null;
  }

  // Extract property name
  if (typescript.isIdentifier(node.name)) {
    return node.name.text;
  }

  return null;
};

const createAnonymousNameFactory = (): ((kind: string) => string) => {
  const counters = new Map<string, number>();
  return (kind) => {
    const count = counters.get(kind) ?? 0;
    counters.set(kind, count + 1);
    return `${kind}#${count}`;
  };
};

const isGqlDefinitionCall = (node: ts.Node, typescript: typeof ts): node is ts.CallExpression => {
  if (!typescript.isCallExpression(node)) {
    return false;
  }
  if (!typescript.isPropertyAccessExpression(node.expression)) {
    return false;
  }
  if (!isGqlReference(node.expression.expression, typescript)) {
    return false;
  }
  if (node.arguments.length === 0) {
    return false;
  }
  const firstArg = node.arguments[0];
  if (firstArg === undefined) {
    return false;
  }
  return typescript.isArrowFunction(firstArg);
};

const isGqlReference = (expr: ts.Expression, typescript: typeof ts): boolean => {
  if (typescript.isIdentifier(expr) && expr.text === "gql") {
    return true;
  }
  if (!typescript.isPropertyAccessExpression(expr)) {
    return false;
  }
  if (typescript.isIdentifier(expr.name) && expr.name.text === "gql") {
    return true;
  }
  return isGqlReference(expr.expression, typescript);
};

const resolveTopLevelExport = (
  callNode: ts.CallExpression,
  exportBindings: ExportBindingMap,
  typescript: typeof ts,
): { readonly isExported: true; readonly exportBinding: string } | null => {
  // ESM: const foo = gql.default(...); export { foo };
  const parent = callNode.parent;
  if (!parent) {
    return null;
  }

  if (typescript.isVariableDeclaration(parent)) {
    const { name } = parent;
    if (typescript.isIdentifier(name)) {
      const exportBinding = exportBindings.get(name.text);
      if (exportBinding) {
        return { isExported: true, exportBinding };
      }
    }
  }

  // CommonJS: exports.foo = gql.default(...);
  if (typescript.isBinaryExpression(parent)) {
    const exportName = getCommonJsExportName(parent.left, typescript);
    if (exportName && exportBindings.has(exportName)) {
      return { isExported: true, exportBinding: exportName };
    }
  }

  return null;
};

const maybeEnterScope = (
  node: ts.Node,
  tracker: CanonicalPathTracker,
  getAnonymousName: (kind: string) => string,
  typescript: typeof ts,
): ScopeHandle | null => {
  // CommonJS exports: exports.foo = ... or module.exports.foo = ...
  if (typescript.isBinaryExpression(node)) {
    const exportName = getCommonJsExportName(node.left, typescript);
    if (exportName) {
      return tracker.enterScope({ segment: exportName, kind: "variable", stableKey: `var:${exportName}` });
    }
  }

  if (typescript.isVariableDeclaration(node) && typescript.isIdentifier(node.name)) {
    const name = node.name.text;
    return tracker.enterScope({ segment: name, kind: "variable", stableKey: `var:${name}` });
  }

  if (typescript.isArrowFunction(node)) {
    const name = getAnonymousName("arrow");
    return tracker.enterScope({ segment: name, kind: "function", stableKey: "arrow" });
  }

  if (typescript.isFunctionDeclaration(node) || typescript.isFunctionExpression(node)) {
    const explicitName = node.name?.text;
    const name = explicitName ?? getAnonymousName("function");
    return tracker.enterScope({ segment: name, kind: "function", stableKey: `func:${name}` });
  }

  if (typescript.isClassDeclaration(node)) {
    const explicitName = node.name?.text;
    const name = explicitName ?? getAnonymousName("class");
    return tracker.enterScope({ segment: name, kind: "class", stableKey: `class:${name}` });
  }

  if (typescript.isMethodDeclaration(node) && typescript.isIdentifier(node.name)) {
    const name = node.name.text;
    return tracker.enterScope({ segment: name, kind: "method", stableKey: `member:${name}` });
  }

  if (typescript.isPropertyDeclaration(node) && typescript.isIdentifier(node.name)) {
    const name = node.name.text;
    return tracker.enterScope({ segment: name, kind: "property", stableKey: `member:${name}` });
  }

  if (typescript.isPropertyAssignment(node)) {
    const key = node.name;
    const name = typescript.isIdentifier(key) ? key.text : typescript.isStringLiteral(key) ? key.text : null;
    if (name) {
      return tracker.enterScope({ segment: name, kind: "property", stableKey: `prop:${name}` });
    }
  }

  return null;
};
