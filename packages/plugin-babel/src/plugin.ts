import { existsSync, readFileSync } from "node:fs";
import { dirname, join as joinPath, resolve as resolvePath } from "node:path";

import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import { parse } from "@babel/parser";
import traverse, { type Binding, type NodePath } from "@babel/traverse";
import { type BuilderArtifact, createRuntimeBindingName } from "@soda-gql/builder";
import { unwrapNullish } from "@soda-gql/tool-utils";
import type { DefinitionNode, DocumentNode, FieldNode, SelectionNode } from "graphql";
import { loadArtifact, lookupRef, resolveCanonicalId } from "./artifact";
import { normalizeOptions } from "./options";
import type { SodaGqlBabelOptions } from "./types";

type SourceCacheEntry = {
  readonly calls: Map<SupportedMethod, Map<string, t.CallExpression>>;
};

export type PluginState = {
  readonly options: SodaGqlBabelOptions;
  readonly artifact: BuilderArtifact;
  readonly sourceCache: Map<string, SourceCacheEntry>;
};

type PluginPassState = PluginPass & { _state?: PluginState };

type PlainObject = Record<string, unknown>;

type SupportedMethod = "model" | "querySlice" | "query";

const gqlMethodNames = new Set<SupportedMethod>(["model", "querySlice", "query"]);

const asSupportedMethod = (node: t.CallExpression): SupportedMethod | null => {
  if (!t.isMemberExpression(node.callee)) {
    return null;
  }

  if (!t.isIdentifier(node.callee.object, { name: "gql" })) {
    return null;
  }

  const property = node.callee.property;
  if (!t.isIdentifier(property)) {
    return null;
  }

  if (!gqlMethodNames.has(property.name as SupportedMethod)) {
    return null;
  }

  return property.name as SupportedMethod;
};

const collectExportSegments = (callPath: NodePath<t.CallExpression>): readonly string[] | null => {
  let current: NodePath<t.Node> | null = callPath;
  const segments: string[] = [];

  while (current) {
    const parent = current.parentPath;
    if (!parent) {
      return null;
    }

    if (parent.isObjectProperty()) {
      const key = parent.node.key;
      if (t.isIdentifier(key)) {
        segments.unshift(key.name);
      } else if (t.isStringLiteral(key)) {
        segments.unshift(key.value);
      } else {
        return null;
      }
      current = parent;
      continue;
    }

    if (parent.isObjectExpression()) {
      current = parent;
      continue;
    }

    if (parent.isVariableDeclarator()) {
      const id = parent.node.id;
      if (!t.isIdentifier(id)) {
        return null;
      }

      const declaration = parent.parentPath;
      if (!declaration || !declaration.isVariableDeclaration()) {
        return null;
      }

      const exportDecl = declaration.parentPath;
      if (!exportDecl || !exportDecl.isExportNamedDeclaration()) {
        return null;
      }

      segments.unshift(id.name);
      return segments;
    }

    return null;
  }

  return null;
};

const makeExportName = (segments: readonly string[]): string | null => {
  if (segments.length === 0) {
    return null;
  }

  return segments.join(".");
};

const parserOptions: Parameters<typeof parse>[1] = {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
};

const cloneCallExpression = (call: t.CallExpression): t.CallExpression => t.cloneNode(call, /* deep */ true);

const loadSourceCacheEntry = (state: PluginState, filePath: string): SourceCacheEntry | null => {
  const existing = state.sourceCache.get(filePath);
  if (existing) {
    return existing;
  }

  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let ast: t.File;
  try {
    ast = parse(contents, parserOptions);
  } catch {
    return null;
  }

  const entry: SourceCacheEntry = {
    calls: new Map(),
  };

  traverse(ast, {
    CallExpression(callPath) {
      const method = asSupportedMethod(callPath.node);
      if (!method) {
        return;
      }

      const segments = collectExportSegments(callPath);
      if (!segments) {
        return;
      }

      const exportName = makeExportName(segments);
      if (!exportName) {
        return;
      }

      const methodCalls = entry.calls.get(method) ?? new Map<string, t.CallExpression>();
      if (!methodCalls.has(exportName)) {
        methodCalls.set(exportName, cloneCallExpression(callPath.node));
        entry.calls.set(method, methodCalls);
      }
    },
  });

  state.sourceCache.set(filePath, entry);
  return entry;
};

const getOriginalArgument = (
  state: PluginState,
  canonicalId: string,
  method: SupportedMethod,
  argumentIndex: number,
): t.Expression | null => {
  const [filePath, exportName] = canonicalId.split("::");
  if (!filePath || !exportName) {
    return null;
  }

  const cache = loadSourceCacheEntry(state, filePath);
  if (!cache) {
    return null;
  }

  const methodCalls = cache.calls.get(method);
  if (!methodCalls) {
    return null;
  }

  const call = methodCalls.get(exportName);
  if (!call) {
    return null;
  }

  const argument = call.arguments[argumentIndex];
  if (!argument || !t.isExpression(argument)) {
    return null;
  }

  return t.cloneNode(argument, /* deep */ true);
};

const ensureGqlRuntimeImport = (programPath: NodePath<t.Program>) => {
  const existing = programPath.node.body.find(
    (statement) => statement.type === "ImportDeclaration" && statement.source.value === "@soda-gql/runtime",
  );

  if (existing) {
    const hasSpecifier = existing.specifiers.some(
      (specifier) =>
        specifier.type === "ImportSpecifier" &&
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "gqlRuntime",
    );

    if (!hasSpecifier) {
      existing.specifiers = [...existing.specifiers, t.importSpecifier(t.identifier("gqlRuntime"), t.identifier("gqlRuntime"))];
    }

    return;
  }

  programPath.node.body.unshift(
    t.importDeclaration(
      [t.importSpecifier(t.identifier("gqlRuntime"), t.identifier("gqlRuntime"))],
      t.stringLiteral("@soda-gql/runtime"),
    ),
  );
};

const maybeRemoveUnusedGqlImport = (programPath: NodePath<t.Program>) => {
  const binding = programPath.scope.getBinding("gql");
  if (!binding || binding.referencePaths.length > 0) {
    return;
  }

  const importSpecifierPath = binding.path;
  if (!importSpecifierPath.isImportSpecifier()) {
    return;
  }

  const declaration = importSpecifierPath.parentPath;
  if (!declaration?.isImportDeclaration()) {
    return;
  }

  const remainingSpecifiers = declaration.node.specifiers.filter((specifier) => specifier !== importSpecifierPath.node);

  if (remainingSpecifiers.length === 0) {
    declaration.remove();
    return;
  }

  declaration.replaceWith(t.importDeclaration(remainingSpecifiers, declaration.node.source));
};

const clone = <T extends t.Node>(node: T): T => t.cloneNode(node, /* deep */ true);

const buildLiteralFromValue = (value: unknown): t.Expression => {
  if (value === null) {
    return t.nullLiteral();
  }

  if (value === undefined) {
    return t.unaryExpression("void", t.numericLiteral(0));
  }

  if (typeof value === "string") {
    return t.stringLiteral(value);
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? t.numericLiteral(value) : t.numericLiteral(value);
  }

  if (typeof value === "boolean") {
    return t.booleanLiteral(value);
  }

  if (Array.isArray(value)) {
    return t.arrayExpression(value.map((entry) => buildLiteralFromValue(entry)));
  }

  if (typeof value === "object") {
    const props = Object.entries(value as PlainObject).map(([key, entry]) =>
      t.objectProperty(t.stringLiteral(key), buildLiteralFromValue(entry)),
    );
    return t.objectExpression(props);
  }

  throw new Error(`Unsupported literal value in builder artifact: ${String(value)}`);
};

const convertTypeRefCall = (expression: t.Expression): t.Expression => {
  if (!t.isCallExpression(expression) || !t.isMemberExpression(expression.callee)) {
    throw new Error("Expected gql.* call in type reference");
  }

  if (!t.isIdentifier(expression.callee.object, { name: "gql" }) || !t.isIdentifier(expression.callee.property)) {
    throw new Error("Unsupported type reference expression");
  }

  const kind = expression.callee.property.name;
  const [tupleArg, defaultArg] = expression.arguments;
  if (!tupleArg || !t.isArrayExpression(tupleArg)) {
    throw new Error("Expected tuple argument in gql type reference");
  }

  const [nameNode, modifierNode] = tupleArg.elements;
  if (!nameNode || !t.isStringLiteral(nameNode)) {
    throw new Error("Expected string literal for type name");
  }

  const name = clone(nameNode);
  const modifier = modifierNode && t.isStringLiteral(modifierNode) ? clone(modifierNode) : t.stringLiteral("");

  const properties: t.ObjectProperty[] = [
    t.objectProperty(t.identifier("kind"), t.stringLiteral(kind)),
    t.objectProperty(t.identifier("name"), name),
    t.objectProperty(t.identifier("modifier"), modifier),
  ];

  if (defaultArg) {
    properties.push(t.objectProperty(t.identifier("defaultValue"), clone(defaultArg)));
  }

  return t.objectExpression(properties);
};

const convertVariablesObject = (node: t.Expression): t.Expression => {
  if (t.isNullLiteral(node)) {
    return t.nullLiteral();
  }

  if (!t.isObjectExpression(node)) {
    throw new Error("Expected object expression for variable definitions");
  }

  const props = node.properties.map((prop) => {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) {
      throw new Error("Unsupported variable definition property");
    }

    const value = convertTypeRefCall(prop.value as t.Expression);
    return t.objectProperty(t.identifier(prop.key.name), value);
  });

  return t.objectExpression(props);
};

const convertSliceVariables = (node: t.Expression | undefined): t.Expression | null => {
  if (!node) {
    return null;
  }

  if (!t.isArrayExpression(node) || node.elements.length === 0) {
    return null;
  }

  const [element] = node.elements;
  if (!element || !t.isObjectExpression(element)) {
    return null;
  }

  return convertVariablesObject(element);
};

const collectSelectPaths = (expression: t.Expression): readonly string[] => {
  const paths: string[] = [];

  const visit = (node: t.Node) => {
    if (t.isCallExpression(node)) {
      const callee = node.callee;
      const isSelect =
        (t.isIdentifier(callee) && callee.name === "select") ||
        (t.isMemberExpression(callee) && t.isIdentifier(callee.property, { name: "select" }));

      if (isSelect) {
        const [first] = node.arguments;
        if (first && t.isStringLiteral(first)) {
          paths.push(first.value);
        }
      }
    }

    const keys = t.VISITOR_KEYS[node.type] ?? [];
    for (const key of keys) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        value.forEach((child) => {
          if (child && typeof child === "object") {
            visit(child as t.Node);
          }
        });
        continue;
      }

      if (value && typeof value === "object") {
        visit(value as t.Node);
      }
    }
  };

  visit(expression);
  return paths;
};

const collectCalleeSegments = (callee: t.Expression): readonly string[] => {
  if (t.isIdentifier(callee)) {
    return [callee.name];
  }

  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) {
    const objectSegments = collectCalleeSegments(callee.object as t.Expression);
    return [...objectSegments, callee.property.name];
  }

  return [];
};

const resolveImportPath = (filename: string, source: string): string | null => {
  if (!source.startsWith(".")) {
    return null;
  }

  const base = resolvePath(dirname(filename), source);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.mts`,
    `${base}.cts`,
    joinPath(base, "index.ts"),
    joinPath(base, "index.tsx"),
    joinPath(base, "index.js"),
    joinPath(base, "index.jsx"),
    joinPath(base, "index.mjs"),
    joinPath(base, "index.cjs"),
    joinPath(base, "index.mts"),
    joinPath(base, "index.cts"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const resolveCanonicalIdFromBinding = (
  binding: Binding,
  segments: readonly string[],
  dependencies: readonly string[],
  filename: string,
): string | null => {
  const bindingPath = binding.path;

  if (bindingPath.isImportSpecifier()) {
    const importDeclaration = bindingPath.parentPath?.parentPath;
    if (!importDeclaration || !importDeclaration.isImportDeclaration()) {
      return null;
    }

    const importSource = importDeclaration.node.source.value;
    const resolved = resolveImportPath(filename, importSource);
    const importedName = bindingPath.node.imported?.name ?? bindingPath.node.local.name;
    const exportPath = [importedName, ...segments.slice(1)].join(".");

    if (resolved) {
      const canonical = dependencies.find((entry) => entry === `${resolved}::${exportPath}`);
      if (canonical) {
        return canonical;
      }
    }

    const matches = dependencies.filter((entry) => entry.endsWith(`::${exportPath}`));
    if (matches.length === 1) {
      return unwrapNullish(matches[0], "safe-array-item-access");
    }
  }

  if (bindingPath.isImportNamespaceSpecifier()) {
    const importDeclaration = bindingPath.parentPath;
    if (!importDeclaration || !importDeclaration.isImportDeclaration()) {
      return null;
    }

    const importSource = importDeclaration.node.source.value;
    const resolved = resolveImportPath(filename, importSource);
    const exportPath = segments.slice(1).join(".");

    if (resolved) {
      const canonical = dependencies.find((entry) => entry === `${resolved}::${exportPath}`);
      if (canonical) {
        return canonical;
      }
    }

    const matches = dependencies.filter((entry) => entry.endsWith(`::${exportPath}`));
    if (matches.length === 1) {
      return unwrapNullish(matches[0], "safe-array-item-access");
    }
  }

  if (bindingPath.isImportDefaultSpecifier()) {
    const importDeclaration = bindingPath.parentPath;
    if (!importDeclaration || !importDeclaration.isImportDeclaration()) {
      return null;
    }

    const importSource = importDeclaration.node.source.value;
    const resolved = resolveImportPath(filename, importSource);
    const exportPath = ["default", ...segments.slice(1)].join(".");

    if (resolved) {
      const canonical = dependencies.find((entry) => entry === `${resolved}::${exportPath}`);
      if (canonical) {
        return canonical;
      }
    }

    const matches = dependencies.filter((entry) => entry.endsWith(`::${exportPath}`));
    if (matches.length === 1) {
      return unwrapNullish(matches[0], "safe-array-item-access");
    }
  }

  if (bindingPath.isVariableDeclarator() || bindingPath.isFunctionDeclaration()) {
    const exportPath = segments.join(".");
    const localCanonical = resolveCanonicalId(filename, exportPath);
    if (dependencies.includes(localCanonical)) {
      return localCanonical;
    }
  }

  return null;
};

const resolveSliceCanonicalId = (
  valuePath: NodePath<t.CallExpression>,
  dependencies: readonly string[],
  filename: string,
): string | null => {
  const calleePath = valuePath.get("callee");
  const segments = collectCalleeSegments(calleePath.node as t.Expression);
  if (segments.length === 0) {
    return null;
  }

  const exportPath = segments.join(".");
  const matches = dependencies.filter((entry) => entry.endsWith(`::${exportPath}`));
  if (matches.length === 1) {
    return matches[0];
  }

  const root = segments[0];
  const binding = calleePath.scope.getBinding(root);
  if (binding) {
    const resolved = resolveCanonicalIdFromBinding(binding, segments, dependencies, filename);
    if (resolved) {
      return resolved;
    }
  }

  if (matches.length > 0) {
    return matches[0];
  }

  const localCanonical = resolveCanonicalId(filename, exportPath);
  if (dependencies.includes(localCanonical)) {
    return localCanonical;
  }

  return null;
};

const getSliceBuilderObjectExpression = (builderPath: NodePath<t.Expression>): NodePath<t.ObjectExpression> | null => {
  if (builderPath.isObjectExpression()) {
    return builderPath;
  }

  if (builderPath.isArrowFunctionExpression() || builderPath.isFunctionExpression()) {
    const bodyPath = builderPath.get("body");
    if (Array.isArray(bodyPath)) {
      return null;
    }

    if (bodyPath.isObjectExpression()) {
      return bodyPath as NodePath<t.ObjectExpression>;
    }

    if (bodyPath.isBlockStatement()) {
      for (const statement of bodyPath.get("body")) {
        if (statement.isReturnStatement()) {
          const argument = statement.get("argument");
          if (!Array.isArray(argument) && argument?.isObjectExpression()) {
            return argument as NodePath<t.ObjectExpression>;
          }
        }
      }
    }
  }

  return null;
};

type ProjectionEntry = {
  readonly label: string;
  readonly path: string;
  readonly rootFieldKeys: readonly string[];
};

type ProjectionPathGraphNode = {
  readonly matches: readonly { readonly label: string; readonly path: string; readonly exact: boolean }[];
  readonly children: Record<string, ProjectionPathGraphNode>;
};

const createFieldPathSegments = (path: string): readonly string[] => {
  if (path === "$") {
    return [];
  }

  const segments = path.split(".");
  if (segments[0] !== "$") {
    throw new Error("Field path must start with $");
  }

  return segments.slice(1);
};

const buildProjectionPathGraph = (entries: readonly ProjectionEntry[]): ProjectionPathGraphNode => {
  type NormalizedPath = { readonly label: string; readonly path: string; readonly segments: readonly string[] };

  const deduped = Array.from(
    entries
      .reduce((acc, entry) => {
        const key = `${entry.label}::${entry.path}`;
        if (!acc.has(key)) {
          acc.set(key, entry);
        }
        return acc;
      }, new Map<string, ProjectionEntry>())
      .values(),
  );

  const normalized = deduped.flatMap<NormalizedPath>(({ label, path, rootFieldKeys }) => {
    const segments = createFieldPathSegments(path);

    if (segments.length === 0) {
      if (rootFieldKeys.length === 0) {
        return [];
      }

      return rootFieldKeys.map((rootKey) => ({ label, path, segments: [`${label}_${rootKey}`] }));
    }

    const [first, ...rest] = segments;
    return [{ label, path, segments: [`${label}_${first}`, ...rest] }];
  });

  const build = (paths: readonly NormalizedPath[]): ProjectionPathGraphNode => {
    const sortedPaths = [...paths].sort((a, b) => {
      const aSegment = a.segments[0] ?? "";
      const bSegment = b.segments[0] ?? "";
      if (aSegment !== bSegment) {
        return aSegment.localeCompare(bSegment);
      }
      if (a.label !== b.label) {
        return a.label.localeCompare(b.label);
      }
      return a.path.localeCompare(b.path);
    });

    const matches = sortedPaths.map(({ label, path, segments }) => ({
      label,
      path,
      exact: segments.length === 0,
    }));

    const buckets = new Map<string, NormalizedPath[]>();

    sortedPaths.forEach(({ label, path, segments }) => {
      const [first, ...rest] = segments;
      if (!first) {
        return;
      }
      const bucket = buckets.get(first) ?? [];
      bucket.push({ label, path, segments: rest });
      buckets.set(first, bucket);
    });

    const children = Object.fromEntries(
      Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([segment, bucket]) => [segment, build(bucket)]),
    );

    return {
      matches,
      children,
    } satisfies ProjectionPathGraphNode;
  };

  return build(normalized);
};

const projectionGraphToAst = (graph: ProjectionPathGraphNode): t.Expression =>
  t.objectExpression([
    t.objectProperty(
      t.identifier("matches"),
      t.arrayExpression(
        graph.matches.map(({ label, path, exact }) =>
          t.objectExpression([
            t.objectProperty(t.identifier("label"), t.stringLiteral(label)),
            t.objectProperty(t.identifier("path"), t.stringLiteral(path)),
            t.objectProperty(t.identifier("exact"), t.booleanLiteral(exact)),
          ]),
        ),
      ),
    ),
    t.objectProperty(
      t.identifier("children"),
      t.objectExpression(
        Object.entries(graph.children).map(([segment, node]) =>
          t.objectProperty(t.stringLiteral(segment), projectionGraphToAst(node)),
        ),
      ),
    ),
  ]);

const collectSliceUsageEntries = (
  slicesBuilderPath: NodePath<t.Expression>,
  dependencies: readonly string[],
  state: PluginState,
  filename: string,
): ProjectionEntry[] => {
  const objectPath = getSliceBuilderObjectExpression(slicesBuilderPath);
  if (!objectPath) {
    return [];
  }

  const entries: ProjectionEntry[] = [];
  objectPath.get("properties").forEach((propertyPath) => {
    if (!propertyPath.isObjectProperty()) {
      return;
    }

    const key = propertyPath.node.key;
    const label = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null;
    if (!label) {
      return;
    }

    const valuePath = propertyPath.get("value");
    if (Array.isArray(valuePath) || !valuePath.isCallExpression()) {
      return;
    }

    const canonicalId = resolveSliceCanonicalId(valuePath, dependencies, filename);
    if (!canonicalId) {
      return;
    }

    const projectionBuilder = getOriginalArgument(state, canonicalId, "querySlice", 2);
    if (!projectionBuilder) {
      return;
    }
    const rootFieldKeys = getSliceRootFieldKeys(state.artifact, canonicalId);
    const paths = collectSelectPaths(projectionBuilder);
    paths.forEach((path) => {
      entries.push({ label, path, rootFieldKeys });
    });
  });

  return entries;
};

const isRuntimePlaceholderFunction = (node: t.ArrowFunctionExpression | t.FunctionExpression): boolean => {
  if (!t.isBlockStatement(node.body)) {
    return false;
  }

  if (node.body.body.length !== 1) {
    return false;
  }

  const [statement] = node.body.body;
  if (!t.isReturnStatement(statement)) {
    return false;
  }

  if (!statement.argument || !t.isObjectExpression(statement.argument) || statement.argument.properties.length > 0) {
    return false;
  }

  const comments = [...(statement.leadingComments ?? []), ...(node.body.leadingComments ?? []), ...(node.leadingComments ?? [])];
  return comments.some((comment) => comment.value.includes("runtime function"));
};

const expressionContainsPlaceholder = (expression: t.Expression): boolean => {
  let found = false;

  const visit = (node: t.Node) => {
    if (found) {
      return;
    }

    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      if (isRuntimePlaceholderFunction(node)) {
        found = true;
        return;
      }
    }

    const keys = t.VISITOR_KEYS[node.type] ?? [];
    for (const key of keys) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object") {
            visit(child as t.Node);
            if (found) {
              return;
            }
          }
        }
      } else if (value && typeof value === "object") {
        visit(value as t.Node);
        if (found) {
          return;
        }
      }
    }
  };

  visit(expression);
  return found;
};

const stripTypeAnnotations = <T extends t.Expression>(expression: T): T => {
  const stripNode = (node: t.Node): t.Node => {
    if (
      t.isTSAsExpression(node) ||
      t.isTSNonNullExpression(node) ||
      t.isTSTypeAssertion(node) ||
      t.isTSInstantiationExpression(node)
    ) {
      return stripNode(node.expression as t.Node);
    }

    if (t.isIdentifier(node)) {
      node.typeAnnotation = null;
    }

    if (t.isObjectPattern(node) || t.isArrayPattern(node)) {
      node.typeAnnotation = null;
    }

    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      node.returnType = null;
      node.typeParameters = null;
    }

    const keys = t.VISITOR_KEYS[node.type] ?? [];
    keys.forEach((key) => {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        (node as unknown as Record<string, unknown>)[key] = value.map((child) =>
          child && typeof child === "object" ? stripNode(child as t.Node) : child,
        );
        return;
      }

      if (value && typeof value === "object") {
        (node as unknown as Record<string, unknown>)[key] = stripNode(value as t.Node);
      }
    });

    return node;
  };

  return stripNode(expression) as T;
};

const isFieldSelection = (selection: SelectionNode): selection is FieldNode => selection.kind === "Field";

const collectRootFieldKeysFromDefinition = (definition: DefinitionNode, registry: string[]) => {
  if (definition.kind !== "OperationDefinition" && definition.kind !== "FragmentDefinition") {
    return;
  }

  const selectionSet = definition.selectionSet;
  if (!selectionSet) {
    return;
  }

  selectionSet.selections.forEach((selectionNode) => {
    if (!isFieldSelection(selectionNode)) {
      return;
    }

    const name = selectionNode.name?.value;
    if (typeof name !== "string" || name.length === 0) {
      return;
    }

    if (!registry.includes(name)) {
      registry.push(name);
    }
  });
};

const getSliceRootFieldKeys = (artifact: BuilderArtifact, canonicalId: string): readonly string[] => {
  const refEntry = lookupRef(artifact, canonicalId);
  if (!refEntry || refEntry.kind !== "slice") {
    return [];
  }

  const documentName = refEntry.document;
  if (typeof documentName !== "string" || documentName.length === 0) {
    return [];
  }

  const documentEntry = artifact.documents?.[documentName];
  if (!documentEntry) {
    return [];
  }

  const documentAst = documentEntry.ast as DocumentNode | undefined;
  if (!documentAst || documentAst.kind !== "Document" || !Array.isArray(documentAst.definitions)) {
    return [];
  }

  const rootKeys: string[] = [];
  documentAst.definitions.forEach((definition) => {
    collectRootFieldKeysFromDefinition(definition, rootKeys);
  });

  return rootKeys;
};

const extractOperationVariableNames = (documentAst: DocumentNode | undefined): readonly string[] => {
  if (!documentAst || documentAst.kind !== "Document" || !Array.isArray(documentAst.definitions)) {
    return [];
  }

  const variableNames: string[] = [];

  documentAst.definitions.forEach((definition) => {
    if (definition.kind !== "OperationDefinition" || !Array.isArray(definition.variableDefinitions)) {
      return;
    }

    definition.variableDefinitions.forEach((variableDefinition) => {
      const name = variableDefinition.variable?.name?.value;
      if (typeof name !== "string" || name.length === 0) {
        return;
      }

      if (!variableNames.includes(name)) {
        variableNames.push(name);
      }
    });
  });

  return variableNames;
};

const getRuntimeCanonicalId = (callPath: NodePath<t.CallExpression>, method: SupportedMethod): string | null => {
  const factoryName = method === "model" ? "createModel" : method === "querySlice" ? "createSlice" : "createOperation";

  const factoryCall = callPath.findParent(
    (parent) => parent.isCallExpression() && t.isIdentifier(parent.node.callee, { name: factoryName }),
  );

  if (!factoryCall || !factoryCall.isCallExpression()) {
    return null;
  }

  const [idArg] = factoryCall.node.arguments;
  if (!idArg || !t.isStringLiteral(idArg)) {
    return null;
  }

  return idArg.value;
};

const resolveModelTransform = (
  callPath: NodePath<t.CallExpression>,
  state: PluginState,
  transform: t.Expression,
): t.Expression => {
  if (t.isArrowFunctionExpression(transform) || t.isFunctionExpression(transform)) {
    if (isRuntimePlaceholderFunction(transform)) {
      const canonicalId = getRuntimeCanonicalId(callPath, "model");
      if (canonicalId) {
        const original = getOriginalArgument(state, canonicalId, "model", 2);
        if (original) {
          return stripTypeAnnotations(original);
        }
      }
    }
  }

  return clone(transform);
};

const resolveSliceProjectionBuilder = (
  callPath: NodePath<t.CallExpression>,
  state: PluginState,
  builder: t.Expression,
): t.Expression => {
  if (expressionContainsPlaceholder(builder)) {
    const canonicalId = getRuntimeCanonicalId(callPath, "querySlice");
    if (canonicalId) {
      const original = getOriginalArgument(state, canonicalId, "querySlice", 2);
      if (original) {
        return stripTypeAnnotations(original);
      }
    }
  }

  return clone(builder);
};

const buildModelRuntimeCall = (callPath: NodePath<t.CallExpression>, state: PluginState): t.Expression => {
  const [target, , transform] = callPath.node.arguments;
  if (!target || !transform) {
    throw new Error("gql.model requires a target and transform");
  }

  const properties: t.ObjectProperty[] = [];

  if (t.isStringLiteral(target)) {
    properties.push(t.objectProperty(t.identifier("typename"), clone(target)));
  } else if (t.isArrayExpression(target)) {
    const [typenameNode, variablesNode] = target.elements;
    if (!typenameNode || !t.isStringLiteral(typenameNode)) {
      throw new Error("Expected string literal typename in gql.model");
    }
    properties.push(t.objectProperty(t.identifier("typename"), clone(typenameNode)));
    if (variablesNode && t.isObjectExpression(variablesNode)) {
      properties.push(t.objectProperty(t.identifier("variables"), convertVariablesObject(variablesNode)));
    }
  } else {
    throw new Error("Unsupported target for gql.model");
  }

  if (!t.isExpression(transform)) {
    throw new Error("Unsupported transform for gql.model");
  }

  const resolvedTransform = resolveModelTransform(callPath, state, transform);
  properties.push(t.objectProperty(t.identifier("transform"), resolvedTransform));

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")), [
    t.objectExpression(properties),
  ]);
};

const buildSliceRuntimeCall = (callPath: NodePath<t.CallExpression>, state: PluginState): t.Expression => {
  const [variables, , projectionBuilder] = callPath.node.arguments;
  if (!projectionBuilder || !t.isExpression(projectionBuilder)) {
    throw new Error("gql.querySlice requires a projection builder");
  }

  const properties: t.ObjectProperty[] = [];
  const canonicalId = getRuntimeCanonicalId(callPath, "querySlice");
  const rootFieldKeys = canonicalId ? getSliceRootFieldKeys(state.artifact, canonicalId) : [];
  const variablesExpr = convertSliceVariables(variables);
  if (variablesExpr) {
    properties.push(t.objectProperty(t.identifier("variables"), variablesExpr));
  }

  properties.push(
    t.objectProperty(t.identifier("rootFieldKeys"), t.arrayExpression(rootFieldKeys.map((key) => t.stringLiteral(key)))),
  );

  const resolvedBuilder = resolveSliceProjectionBuilder(callPath, state, projectionBuilder);
  properties.push(
    t.objectProperty(
      t.identifier("projections"),
      t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("handleProjectionBuilder")), [
        resolvedBuilder,
      ]),
    ),
  );

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("querySlice")), [
    t.objectExpression(properties),
  ]);
};

const buildQueryRuntimeComponents = (
  programPath: NodePath<t.Program>,
  callPath: NodePath<t.CallExpression>,
  canonicalId: string,
  exportName: string,
  state: PluginState,
  filename: string,
) => {
  const [nameArg, _variablesArg, slicesBuilder] = callPath.node.arguments;
  if (!nameArg || !t.isStringLiteral(nameArg) || !slicesBuilder) {
    throw new Error("gql.query requires a name, variables, and slices builder");
  }

  const refEntry = lookupRef(state.artifact, canonicalId);
  if (!refEntry || refEntry.kind !== "query") {
    throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
  }

  const documentKey = refEntry.document;
  if (!documentKey) {
    throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
  }

  const documentEntry = state.artifact.documents?.[documentKey];
  if (!documentEntry) {
    throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
  }

  const dependencies = Array.isArray(refEntry.dependencies) ? refEntry.dependencies : [];
  const slicesBuilderPath = callPath.get("arguments")[2] as NodePath<t.Expression>;
  const projectionEntries = collectSliceUsageEntries(slicesBuilderPath, dependencies, state, filename);
  const projectionGraph = projectionEntries.length > 0 ? buildProjectionPathGraph(projectionEntries) : null;

  const runtimeName = createRuntimeBindingName(canonicalId, exportName);
  const documentIdentifier = `${runtimeName}Document`;

  const documentExpression = buildLiteralFromValue(documentEntry.ast as PlainObject);
  const documentDeclaration = t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(documentIdentifier), documentExpression),
  ]);

  const variableNames = extractOperationVariableNames(documentEntry.ast as DocumentNode | undefined);
  const properties: t.ObjectProperty[] = [
    t.objectProperty(t.identifier("name"), clone(nameArg)),
    t.objectProperty(t.identifier("document"), t.identifier(documentIdentifier)),
  ];

  properties.push(
    t.objectProperty(
      t.identifier("variableNames"),
      t.arrayExpression(variableNames.map((variableName) => t.stringLiteral(variableName))),
    ),
  );

  properties.push(t.objectProperty(t.identifier("getSlices"), clone(slicesBuilder)));

  if (projectionGraph) {
    properties.push(t.objectProperty(t.identifier("projectionPathGraph"), projectionGraphToAst(projectionGraph)));
  }

  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("query")), [
    t.objectExpression(properties),
  ]);

  ensureGqlRuntimeImport(programPath);

  return {
    documentDeclaration,
    runtimeCall,
  };
};

export const createPlugin = (): PluginObj<SodaGqlBabelOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  pre() {
    const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};
    const options = normalizeOptions(rawOptions);
    const artifact = loadArtifact(options.artifactsPath);

    this._state = {
      options,
      artifact,
      sourceCache: new Map(),
    } satisfies PluginState;
  },
  visitor: {
    Program(programPath: NodePath<t.Program>, state) {
      const pass = state as unknown as PluginPassState;
      const pluginState = pass._state;
      if (!pluginState || pluginState.options.mode === "runtime") {
        return;
      }

      const filename = pass.file?.opts?.filename;
      if (!filename) {
        return;
      }

      const transformedQueries = new Set<string>();
      let mutated = false;

      programPath.traverse({
        CallExpression(callPath) {
          const method = asSupportedMethod(callPath.node);
          if (!method) {
            return;
          }

          const segments = collectExportSegments(callPath);
          if (!segments) {
            if (method === "model" || method === "querySlice") {
              ensureGqlRuntimeImport(programPath);
              const replacement =
                method === "model" ? buildModelRuntimeCall(callPath, pluginState) : buildSliceRuntimeCall(callPath, pluginState);
              callPath.replaceWith(replacement);
              mutated = true;
              return;
            }

            throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
          }

          const exportName = makeExportName(segments);
          if (!exportName) {
            throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
          }

          const canonicalId = resolveCanonicalId(filename, exportName);

          if (method === "model" || method === "querySlice") {
            ensureGqlRuntimeImport(programPath);
            const replacement =
              method === "model" ? buildModelRuntimeCall(callPath, pluginState) : buildSliceRuntimeCall(callPath, pluginState);
            callPath.replaceWith(replacement);
            mutated = true;
            return;
          }

          if (method === "query") {
            if (transformedQueries.has(canonicalId)) {
              callPath.replaceWith(t.identifier(exportName));
              return;
            }

            const declaratorPath = callPath.findParent((parent) => parent.isVariableDeclarator());
            if (!declaratorPath || !declaratorPath.isVariableDeclarator()) {
              throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
            }

            if (!t.isIdentifier(declaratorPath.node.id)) {
              throw new Error("SODA_GQL_COMPLEX_EXPORT_UNSUPPORTED");
            }

            const exportDeclPath = declaratorPath.parentPath?.parentPath;
            if (!exportDeclPath || !exportDeclPath.isExportNamedDeclaration()) {
              throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
            }

            const { documentDeclaration, runtimeCall } = buildQueryRuntimeComponents(
              programPath,
              callPath,
              canonicalId,
              declaratorPath.node.id.name,
              pluginState,
              filename,
            );

            const exportDeclaration = t.exportNamedDeclaration(
              t.variableDeclaration("const", [t.variableDeclarator(clone(declaratorPath.node.id), runtimeCall)]),
            );

            exportDeclPath.replaceWithMultiple([documentDeclaration, exportDeclaration]);
            transformedQueries.add(canonicalId);
            mutated = true;
            return;
          }
        },
      });

      if (mutated) {
        programPath.scope.crawl();
        maybeRemoveUnusedGqlImport(programPath);
      }
    },
  },
});
