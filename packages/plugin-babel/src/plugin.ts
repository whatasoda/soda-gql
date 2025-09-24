import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { createRuntimeBindingName, type BuilderArtifact } from "@soda-gql/builder";
import { loadArtifact, lookupRef, resolveCanonicalId } from "./artifact";
import { normalizeOptions } from "./options";
import type { SodaGqlBabelOptions } from "./types";

export type PluginState = {
  readonly options: SodaGqlBabelOptions;
  readonly artifact: BuilderArtifact;
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

const ensureGqlRuntimeImport = (programPath: NodePath<t.Program>) => {
  const existing = programPath.node.body.find(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === "@soda-gql/runtime",
  );

  if (existing) {
    const hasSpecifier = existing.specifiers.some(
      (specifier) =>
        specifier.type === "ImportSpecifier" &&
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "gqlRuntime",
    );

    if (!hasSpecifier) {
      existing.specifiers = [
        ...existing.specifiers,
        t.importSpecifier(t.identifier("gqlRuntime"), t.identifier("gqlRuntime")),
      ];
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
      t.objectProperty(
        t.stringLiteral(key),
        buildLiteralFromValue(entry),
      ),
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

const buildModelRuntimeCall = (args: t.Expression[]): t.Expression => {
  const [target, , transform] = args;
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
      properties.push(
        t.objectProperty(t.identifier("variables"), convertVariablesObject(variablesNode)),
      );
    }
  } else {
    throw new Error("Unsupported target for gql.model");
  }

  properties.push(t.objectProperty(t.identifier("transform"), clone(transform)));

  return t.callExpression(
    t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")),
    [t.objectExpression(properties)],
  );
};

const buildSliceRuntimeCall = (args: t.Expression[]): t.Expression => {
  const [variables, , projectionBuilder] = args;
  if (!projectionBuilder) {
    throw new Error("gql.querySlice requires a projection builder");
  }

  const properties: t.ObjectProperty[] = [];
  const variablesExpr = convertSliceVariables(variables);
  if (variablesExpr) {
    properties.push(t.objectProperty(t.identifier("variables"), variablesExpr));
  }

  properties.push(
    t.objectProperty(
      t.identifier("getProjections"),
      t.callExpression(
        t.memberExpression(t.identifier("gqlRuntime"), t.identifier("handleProjectionBuilder")),
        [clone(projectionBuilder)],
      ),
    ),
  );

  return t.callExpression(
    t.memberExpression(t.identifier("gqlRuntime"), t.identifier("querySlice")),
    [t.objectExpression(properties)],
  );
};

const buildQueryRuntimeComponents = (
  programPath: NodePath<t.Program>,
  callPath: NodePath<t.CallExpression>,
  canonicalId: string,
  exportName: string,
  state: PluginState,
) => {
  const [nameArg, variablesArg, slicesBuilder] = callPath.node.arguments;
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

  const runtimeName = createRuntimeBindingName(canonicalId, exportName);
  const documentIdentifier = `${runtimeName}Document`;

  const documentExpression = buildLiteralFromValue(documentEntry.ast as PlainObject);
  const documentDeclaration = t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(documentIdentifier), documentExpression),
  ]);

  const properties: t.ObjectProperty[] = [
    t.objectProperty(t.identifier("name"), clone(nameArg)),
    t.objectProperty(t.identifier("document"), t.identifier(documentIdentifier)),
  ];

  if (variablesArg && !t.isNullLiteral(variablesArg)) {
    properties.push(t.objectProperty(t.identifier("variables"), convertVariablesObject(variablesArg)));
  }

  properties.push(t.objectProperty(t.identifier("getSlices"), clone(slicesBuilder)));

  const runtimeCall = t.callExpression(
    t.memberExpression(t.identifier("gqlRuntime"), t.identifier("query")),
    [t.objectExpression(properties)],
  );

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
                method === "model"
                  ? buildModelRuntimeCall(callPath.node.arguments)
                  : buildSliceRuntimeCall(callPath.node.arguments);
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
              method === "model"
                ? buildModelRuntimeCall(callPath.node.arguments)
                : buildSliceRuntimeCall(callPath.node.arguments);
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
