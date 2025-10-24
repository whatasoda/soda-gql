/**
 * Metadata collection for gql definitions in SWC AST.
 *
 * Traverses the SWC AST and collects metadata about gql.default() calls,
 * including their canonical paths, export status, and depth in the AST.
 */

import type { CanonicalPathTracker } from "@soda-gql/builder";
import { createCanonicalTracker } from "@soda-gql/builder";
import type { GqlDefinitionMetadata } from "@soda-gql/plugin-common";
import type {
  ArrowFunctionExpression,
  AssignmentExpression,
  CallExpression,
  ClassDeclaration,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  MemberExpression,
  Module,
  ModuleItem,
  VariableDeclarator,
} from "@swc/types";

export type GqlDefinitionMetadataMap = WeakMap<CallExpression, GqlDefinitionMetadata>;

type CanonicalTrackerFactory = typeof createCanonicalTracker;

type CollectArgs = {
  readonly module: Module;
  readonly filename: string;
  readonly createTracker?: CanonicalTrackerFactory;
};

type ScopeHandle = ReturnType<CanonicalPathTracker["enterScope"]>;
type ExportBindingMap = Map<string, string>;

export const collectGqlDefinitionMetadata = ({ module, filename, createTracker }: CollectArgs): GqlDefinitionMetadataMap => {
  const exportBindings = collectExportBindings(module.body);
  const trackerFactory = createTracker ?? createCanonicalTracker;
  const tracker = trackerFactory({
    filePath: filename,
    getExportName: (localName) => exportBindings.get(localName),
  });

  const getAnonymousName = createAnonymousNameFactory();
  const scopeStack: ScopeHandle[] = [];
  const metadata = new WeakMap<CallExpression, GqlDefinitionMetadata>();

  // Traverse the module
  const traverse = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }

    // Handle CallExpression nodes - check if it's a gql definition
    if (isCallExpression(node) && isGqlDefinitionCall(node)) {
      const depthBeforeRegister = tracker.currentDepth();
      const { astPath } = tracker.registerDefinition();
      const isTopLevel = depthBeforeRegister <= 1;
      const exportInfo = isTopLevel ? resolveTopLevelExport(node, exportBindings, module.body) : null;

      metadata.set(node, {
        astPath,
        isTopLevel,
        isExported: exportInfo?.isExported ?? false,
        exportBinding: exportInfo?.exportBinding,
      });

      // Skip traversing the body of gql definitions
      return;
    }

    // Enter scope if applicable
    const handle = maybeEnterScope(node, tracker, getAnonymousName);
    if (handle) {
      scopeStack.push(handle);
    }

    // Recursively traverse children
    if (Array.isArray(node)) {
      for (const child of node) {
        traverse(child);
      }
    } else {
      for (const value of Object.values(node)) {
        if (value && typeof value === "object") {
          traverse(value);
        }
      }
    }

    // Exit scope if we entered one
    if (handle) {
      const poppedHandle = scopeStack.pop();
      if (poppedHandle) {
        tracker.exitScope(poppedHandle);
      }
    }
  };

  traverse(module);

  return metadata;
};

/**
 * Collect export bindings from the module.
 */
const collectExportBindings = (body: ModuleItem[]): ExportBindingMap => {
  const bindings: ExportBindingMap = new Map();

  for (const statement of body) {
    // ESM exports: export const foo = ...
    if (statement.type === "ExportDeclaration" && statement.declaration) {
      const decl = statement.declaration;
      if (decl.type === "VariableDeclaration") {
        for (const declarator of decl.declarations) {
          if (declarator.id.type === "Identifier") {
            bindings.set(declarator.id.value, declarator.id.value);
          }
        }
        continue;
      }

      if (
        (decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") &&
        decl.identifier &&
        decl.identifier.type === "Identifier"
      ) {
        bindings.set(decl.identifier.value, decl.identifier.value);
      }
      continue;
    }

    // CommonJS exports: exports.foo = ... or module.exports.foo = ...
    if (statement.type === "ExpressionStatement" && statement.expression.type === "AssignmentExpression") {
      const exportName = getCommonJsExportName(statement.expression.left);
      if (exportName) {
        bindings.set(exportName, exportName);
      }
    }
  }

  return bindings;
};

/**
 * Extract CommonJS export name from assignment left-hand side.
 */
const getCommonJsExportName = (node: unknown): string | null => {
  if (typeof node !== "object" || node === null || !("type" in node) || node.type !== "MemberExpression") {
    return null;
  }

  const memberExpr = node as MemberExpression;

  if (memberExpr.property.type === "Computed") {
    return null;
  }

  // Check if it's exports.foo or module.exports.foo
  const isExports = memberExpr.object.type === "Identifier" && memberExpr.object.value === "exports";
  const isModuleExports =
    memberExpr.object.type === "MemberExpression" &&
    memberExpr.object.object.type === "Identifier" &&
    memberExpr.object.object.value === "module" &&
    memberExpr.object.property.type === "Identifier" &&
    memberExpr.object.property.value === "exports";

  if (!isExports && !isModuleExports) {
    return null;
  }

  // Extract property name
  if (memberExpr.property.type === "Identifier") {
    return memberExpr.property.value;
  }

  return null;
};

/**
 * Create factory for generating anonymous names.
 */
const createAnonymousNameFactory = (): ((kind: string) => string) => {
  const counters = new Map<string, number>();
  return (kind) => {
    const count = counters.get(kind) ?? 0;
    counters.set(kind, count + 1);
    return `${kind}#${count}`;
  };
};

/**
 * Check if a node is a gql definition call.
 */
const isGqlDefinitionCall = (node: CallExpression): boolean => {
  if (node.callee.type !== "MemberExpression") {
    return false;
  }
  if (!isExpression(node.callee.object)) {
    return false;
  }
  if (!isGqlReference(node.callee.object)) {
    return false;
  }
  if (node.arguments.length === 0) {
    return false;
  }
  const firstArg = node.arguments[0];
  if (!firstArg) {
    return false;
  }
  return firstArg.expression.type === "ArrowFunctionExpression";
};

/**
 * Check if an expression is a reference to `gql`.
 */
const isGqlReference = (expr: Expression): boolean => {
  if (expr.type === "Identifier" && expr.value === "gql") {
    return true;
  }
  if (expr.type !== "MemberExpression") {
    return false;
  }
  if (expr.property.type === "Computed") {
    return false;
  }
  if (expr.property.type === "Identifier" && expr.property.value === "gql") {
    return true;
  }
  // Check if object is also an Expression before recursing
  if (!isExpression(expr.object)) {
    return false;
  }
  return isGqlReference(expr.object);
};

/**
 * Resolve top-level export information for a call expression.
 */
const resolveTopLevelExport = (
  callExpr: CallExpression,
  exportBindings: ExportBindingMap,
  body: ModuleItem[],
): { readonly isExported: true; readonly exportBinding: string } | null => {
  // Find the parent statement/declaration
  for (const item of body) {
    // ESM: export const foo = gql.default(...)
    if (item.type === "ExportDeclaration" && item.declaration?.type === "VariableDeclaration") {
      for (const declarator of item.declaration.declarations) {
        const init = declarator.init;
        if (init && containsCallExpression(init, callExpr)) {
          if (declarator.id.type === "Identifier") {
            return { isExported: true, exportBinding: declarator.id.value };
          }
        }
      }
    }

    // ESM: const foo = gql.default(...); export { foo }
    if (item.type === "VariableDeclaration") {
      for (const declarator of item.declarations) {
        const init = declarator.init;
        if (init && containsCallExpression(init, callExpr)) {
          if (declarator.id.type === "Identifier") {
            const exportBinding = exportBindings.get(declarator.id.value);
            if (exportBinding) {
              return { isExported: true, exportBinding };
            }
          }
        }
      }
    }

    // CommonJS: exports.foo = gql.default(...)
    if (item.type === "ExpressionStatement" && item.expression.type === "AssignmentExpression") {
      const right = item.expression.right;
      if (containsCallExpression(right, callExpr)) {
        const exportName = getCommonJsExportName(item.expression.left);
        if (exportName && exportBindings.has(exportName)) {
          return { isExported: true, exportBinding: exportName };
        }
      }
    }
  }

  return null;
};

/**
 * Check if an expression contains a specific call expression.
 */
const containsCallExpression = (expr: unknown, target: CallExpression): boolean => {
  if (expr === target) {
    return true;
  }
  if (typeof expr !== "object" || !expr) {
    return false;
  }
  for (const value of Object.values(expr)) {
    if (value && typeof value === "object") {
      if (containsCallExpression(value, target)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Enter a scope if applicable for the given node.
 */
const maybeEnterScope = (
  node: unknown,
  tracker: CanonicalPathTracker,
  getAnonymousName: (kind: string) => string,
): ScopeHandle | null => {
  if (!node || typeof node !== "object") {
    return null;
  }

  // CommonJS exports: exports.foo = ... or module.exports.foo = ...
  if (isAssignmentExpression(node)) {
    const exportName = getCommonJsExportName(node.left);
    if (exportName) {
      return tracker.enterScope({ segment: exportName, kind: "variable", stableKey: `var:${exportName}` });
    }
  }

  if (isVariableDeclarator(node) && node.id.type === "Identifier") {
    const name = node.id.value;
    return tracker.enterScope({ segment: name, kind: "variable", stableKey: `var:${name}` });
  }

  if (isArrowFunctionExpression(node)) {
    const name = getAnonymousName("arrow");
    return tracker.enterScope({ segment: name, kind: "function", stableKey: "arrow" });
  }

  if (isFunctionDeclaration(node) || isFunctionExpression(node)) {
    const explicitName = node.identifier?.type === "Identifier" ? node.identifier.value : undefined;
    const name = explicitName ?? getAnonymousName("function");
    return tracker.enterScope({ segment: name, kind: "function", stableKey: `func:${name}` });
  }

  if (isClassDeclaration(node)) {
    const explicitName = node.identifier?.type === "Identifier" ? node.identifier.value : undefined;
    const name = explicitName ?? getAnonymousName("class");
    return tracker.enterScope({ segment: name, kind: "class", stableKey: `class:${name}` });
  }

  // Object properties
  if (isKeyValueProperty(node)) {
    const key = node.key;
    const name = key.type === "Identifier" ? key.value : key.type === "StringLiteral" ? key.value : null;
    if (name) {
      return tracker.enterScope({ segment: name, kind: "property", stableKey: `prop:${name}` });
    }
  }

  return null;
};

// Type guards
const isCallExpression = (node: unknown): node is CallExpression =>
  typeof node === "object" && node !== null && "type" in node && node.type === "CallExpression";

const isExpression = (node: unknown): node is Expression => typeof node === "object" && node !== null && "type" in node;

const isAssignmentExpression = (node: unknown): node is AssignmentExpression =>
  typeof node === "object" && node !== null && "type" in node && node.type === "AssignmentExpression";

const isVariableDeclarator = (node: unknown): node is VariableDeclarator =>
  typeof node === "object" && node !== null && "type" in node && node.type === "VariableDeclarator";

const isArrowFunctionExpression = (node: unknown): node is ArrowFunctionExpression =>
  typeof node === "object" && node !== null && "type" in node && node.type === "ArrowFunctionExpression";

const isFunctionDeclaration = (node: unknown): node is FunctionDeclaration =>
  typeof node === "object" && node !== null && "type" in node && node.type === "FunctionDeclaration";

const isFunctionExpression = (node: unknown): node is FunctionExpression =>
  typeof node === "object" && node !== null && "type" in node && node.type === "FunctionExpression";

const isClassDeclaration = (node: unknown): node is ClassDeclaration =>
  typeof node === "object" && node !== null && "type" in node && node.type === "ClassDeclaration";

const isKeyValueProperty = (node: unknown): node is { type: "KeyValueProperty"; key: { type: "Identifier"; value: string } } =>
  typeof node === "object" &&
  node !== null &&
  "type" in node &&
  node.type === "KeyValueProperty" &&
  "key" in node &&
  typeof node.key === "object" &&
  node.key !== null &&
  "type" in node.key &&
  node.key.type === "Identifier";
