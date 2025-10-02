import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { createCanonicalTracker, type CanonicalPathTracker } from "@soda-gql/builder";

export type GqlDefinitionMetadata = {
  readonly astPath: string;
  readonly isTopLevel: boolean;
  readonly isExported: boolean;
  readonly exportBinding?: string;
};

export type GqlDefinitionMetadataMap = WeakMap<t.CallExpression, GqlDefinitionMetadata>;

type CanonicalTrackerFactory = typeof createCanonicalTracker;

type CollectArgs = {
  readonly programPath: NodePath<t.Program>;
  readonly filename: string;
  readonly createTracker?: CanonicalTrackerFactory;
};

type ScopeHandle = ReturnType<CanonicalPathTracker["enterScope"]>;
type ExportBindingMap = Map<string, string>;

export const collectGqlDefinitionMetadata = ({ programPath, filename, createTracker }: CollectArgs): GqlDefinitionMetadataMap => {
  const exportBindings = collectExportBindings(programPath.node);
  const trackerFactory = createTracker ?? createCanonicalTracker;
  const tracker = trackerFactory({
    filePath: filename,
    getExportName: (localName) => exportBindings.get(localName),
  });

  const getAnonymousName = createAnonymousNameFactory();
  const scopeHandles = new WeakMap<NodePath<t.Node>, ScopeHandle>();
  const metadata = new WeakMap<t.CallExpression, GqlDefinitionMetadata>();

  programPath.traverse({
    enter(path) {
      if (path.isCallExpression() && isGqlDefinitionCall(path.node)) {
        const { astPath } = tracker.registerDefinition();
        const isTopLevel = tracker.currentDepth() === 0;
        const exportInfo = isTopLevel ? resolveTopLevelExport(path, exportBindings) : null;

        metadata.set(path.node, {
          astPath,
          isTopLevel,
          isExported: exportInfo?.isExported ?? false,
          exportBinding: exportInfo?.exportBinding,
        });

        path.skip();
        return;
      }

      const handle = maybeEnterScope(path, tracker, getAnonymousName);
      if (handle) {
        scopeHandles.set(path, handle);
      }
    },
    exit(path) {
      const handle = scopeHandles.get(path);
      if (handle) {
        tracker.exitScope(handle);
        scopeHandles.delete(path);
      }
    },
  });

  return metadata;
};

const collectExportBindings = (program: t.Program): ExportBindingMap => {
  const bindings: ExportBindingMap = new Map();

  for (const statement of program.body) {
    if (!t.isExportNamedDeclaration(statement) || !statement.declaration) {
      continue;
    }

    const { declaration } = statement;
    if (t.isVariableDeclaration(declaration)) {
      for (const declarator of declaration.declarations) {
        if (t.isIdentifier(declarator.id)) {
          bindings.set(declarator.id.name, declarator.id.name);
        }
      }
      continue;
    }

    if ((t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) && declaration.id) {
      bindings.set(declaration.id.name, declaration.id.name);
    }
  }

  return bindings;
};

const createAnonymousNameFactory = (): ((kind: string) => string) => {
  const counters = new Map<string, number>();
  return (kind) => {
    const count = counters.get(kind) ?? 0;
    counters.set(kind, count + 1);
    return `${kind}#${count}`;
  };
};

const isGqlDefinitionCall = (node: t.Node): node is t.CallExpression =>
  t.isCallExpression(node) &&
  t.isMemberExpression(node.callee) &&
  t.isIdentifier(node.callee.object, { name: "gql" }) &&
  node.arguments.length > 0 &&
  t.isArrowFunctionExpression(node.arguments[0]);

const resolveTopLevelExport = (
  callPath: NodePath<t.CallExpression>,
  exportBindings: ExportBindingMap,
): { readonly isExported: true; readonly exportBinding: string } | null => {
  const declarator = callPath.parentPath;
  if (!declarator?.isVariableDeclarator()) {
    return null;
  }

  const { id } = declarator.node;
  if (!t.isIdentifier(id)) {
    return null;
  }

  const exportBinding = exportBindings.get(id.name);
  return exportBinding ? { isExported: true, exportBinding } : null;
};

const maybeEnterScope = (
  path: NodePath<t.Node>,
  tracker: CanonicalPathTracker,
  getAnonymousName: (kind: string) => string,
): ScopeHandle | null => {
  if (path.isVariableDeclarator() && t.isIdentifier(path.node.id)) {
    const name = path.node.id.name;
    return tracker.enterScope({ segment: name, kind: "variable", stableKey: `var:${name}` });
  }

  if (path.isArrowFunctionExpression()) {
    const name = getAnonymousName("arrow");
    return tracker.enterScope({ segment: name, kind: "function", stableKey: "arrow" });
  }

  if (path.isFunctionDeclaration() || path.isFunctionExpression()) {
    const explicitName = path.node.id?.name;
    const name = explicitName ?? getAnonymousName("function");
    return tracker.enterScope({ segment: name, kind: "function", stableKey: `func:${name}` });
  }

  if (path.isClassDeclaration()) {
    const explicitName = path.node.id?.name;
    const name = explicitName ?? getAnonymousName("class");
    return tracker.enterScope({ segment: name, kind: "class", stableKey: `class:${name}` });
  }

  if (path.isClassMethod() && t.isIdentifier(path.node.key)) {
    const name = path.node.key.name;
    return tracker.enterScope({ segment: name, kind: "method", stableKey: `member:${name}` });
  }

  if (path.isClassProperty() && t.isIdentifier(path.node.key)) {
    const name = path.node.key.name;
    return tracker.enterScope({ segment: name, kind: "property", stableKey: `member:${name}` });
  }

  if (path.isObjectProperty()) {
    const key = path.node.key;
    const name = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null;
    if (name) {
      return tracker.enterScope({ segment: name, kind: "property", stableKey: `prop:${name}` });
    }
  }

  return null;
};
