import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { type BuilderArtifact, type CanonicalId, createRuntimeBindingName } from "@soda-gql/builder";
import type { RuntimeModelInput } from "../../core/src/runtime/model";
import type { RuntimeOperationInput } from "../../core/src/runtime/operation";
import type { RuntimeOperationSliceInput } from "../../core/src/runtime/operation-slice";
import { loadArtifact, lookupModelArtifact, lookupOperationArtifact, resolveCanonicalId } from "./artifact";
import { normalizeOptions } from "./options";
import { buildLiteralFromValue, buildObjectExpression, clone } from "./transform/ast-builders";
import type { SodaGqlBabelOptions } from "./types";

export type PluginState = {
  readonly options: SodaGqlBabelOptions;
  readonly artifact: BuilderArtifact;
};

type PluginPassState = PluginPass & { _state?: PluginState };

const collectExportSegments = (callPath: NodePath<t.CallExpression>): readonly string[] | null => {
  let current: NodePath<t.Node> | null = callPath;
  const segments: string[] = [];

  while (current) {
    const parent: NodePath<t.Node> | null = current.parentPath;
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

    // Handle arrow function (from factory pattern)
    if (parent.isArrowFunctionExpression()) {
      current = parent;
      continue;
    }

    // Handle return statement (inside arrow function body)
    if (parent.isReturnStatement()) {
      current = parent;
      continue;
    }

    // Handle block statement (arrow function body)
    if (parent.isBlockStatement()) {
      current = parent;
      continue;
    }

    // Handle call expression (the factory call)
    if (parent.isCallExpression()) {
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
    (statement) => statement.type === "ImportDeclaration" && statement.source.value === "@soda-gql/runtime",
  );

  if (existing && t.isImportDeclaration(existing)) {
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
      [
        t.importSpecifier(t.identifier("gqlRuntime"), t.identifier("gqlRuntime")),
        Object.assign(t.importSpecifier(t.identifier("graphql"), t.identifier("graphql")), { importKind: "type" }),
      ],
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

type ProjectionPathGraphNode = {
  readonly matches: readonly { readonly label: string; readonly path: string; readonly exact: boolean }[];
  readonly children: Record<string, ProjectionPathGraphNode>;
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

type SupportedBuilderName = (typeof supportedBuilderNames)[number];
const supportedBuilderNames = [
  "model",
  "querySlice",
  "mutationSlice",
  "subscriptionSlice",
  "query",
  "mutation",
  "subscription",
] as const;
type GqlCall = {
  nodePath: NodePath<t.CallExpression>;
  canonicalId: CanonicalId;
  schemaName: string;
  builderName: SupportedBuilderName;
  builderCall: t.CallExpression;
};

/**
 * Check if this is a call to gql.${schema}(({ ${method} }) => ${method}(...))
 */
const extractGqlCall = (nodePath: NodePath<t.CallExpression>, filename: string): GqlCall | null => {
  const node = nodePath.node;
  if (!t.isMemberExpression(node.callee)) {
    return null;
  }

  const callee = node.callee;
  if (!t.isIdentifier(callee.object) || callee.object.name !== "gql") {
    return null;
  }

  if (!t.isIdentifier(callee.property)) {
    return null;
  }

  const schemaName = callee.property.name;

  // Get the factory function argument
  if (node.arguments.length !== 1) {
    return null;
  }

  const factoryArg = node.arguments[0];
  if (!t.isArrowFunctionExpression(factoryArg)) {
    return null;
  }

  // Check if the body is a direct call expression or has a return statement
  const builderCall = t.isCallExpression(factoryArg.body)
    ? factoryArg.body
    : t.isBlockStatement(factoryArg.body)
      ? factoryArg.body.body.flatMap((stmt) =>
          t.isReturnStatement(stmt) && t.isCallExpression(stmt.argument) ? stmt.argument : [],
        )[0]
      : null;

  if (!builderCall) {
    return null;
  }

  if (!t.isIdentifier(builderCall.callee)) {
    return null;
  }

  const builderName = builderCall.callee.name as (typeof supportedBuilderNames)[number];
  if (!builderName || !supportedBuilderNames.includes(builderName)) {
    return null;
  }

  const segments = collectExportSegments(nodePath);
  if (!segments) {
    throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
  }

  const exportName = makeExportName(segments);
  if (!exportName) {
    throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
  }

  const canonicalId = resolveCanonicalId(filename, exportName, schemaName);
  if (!canonicalId) {
    throw new Error("SODA_GQL_EXPORT_NOT_FOUND");
  }

  return { nodePath, canonicalId, schemaName, builderName, builderCall };
};

const buildModelRuntimeCall = (gqlCall: GqlCall, state: PluginState): t.Expression => {
  // Check if this is the new factory pattern
  const [, , transform] = gqlCall.builderCall.arguments;
  if (!transform || !t.isExpression(transform)) {
    throw new Error("gql.model requires a transform");
  }

  const model = lookupModelArtifact(state.artifact, gqlCall.canonicalId);
  if (!model) {
    throw new Error("gql.model requires a model");
  }

  const prebuild = buildObjectExpression<keyof RuntimeModelInput["prebuild"]>({
    typename: t.stringLiteral(model.prebuild.typename),
  });
  const runtime = buildObjectExpression<keyof RuntimeModelInput["runtime"]>({
    transform: clone(transform),
  });

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")), [
    buildObjectExpression({ prebuild, runtime }),
  ]);
};

const buildSliceRuntimeCall = (gqlCall: GqlCall, state: PluginState, filename: string): t.Expression => {
  const [, , projectionBuilder] = gqlCall.builderCall.arguments;
  if (!projectionBuilder || !t.isExpression(projectionBuilder)) {
    throw new Error("gql.querySlice requires a projection builder");
  }

  const prebuild = t.nullLiteral();
  const runtime = buildObjectExpression<keyof RuntimeOperationSliceInput["runtime"]>({
    buildProjection: clone(projectionBuilder),
  });

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier(gqlCall.builderName)), [
    buildObjectExpression({ prebuild, runtime }),
  ]);
};

const buildOperationRuntimeComponents = (gqlCall: GqlCall, state: PluginState) => {
  const operationType = gqlCall.builderName;
  const [nameArg, _variablesArg, slicesBuilder] = gqlCall.builderCall.arguments;
  if (!nameArg || !t.isStringLiteral(nameArg) || !slicesBuilder || !t.isExpression(slicesBuilder)) {
    throw new Error("gql.query requires a name, variables, and slices builder");
  }

  const operation = lookupOperationArtifact(state.artifact, gqlCall.canonicalId);
  if (!operation) {
    throw new Error("SODA_GQL_DOCUMENT_NOT_FOUND");
  }

  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier(operationType)), [
    buildObjectExpression({
      prebuild: buildObjectExpression<keyof RuntimeOperationInput["prebuild"]>({
        name: clone(nameArg),
        document: t.tsAsExpression(
          buildLiteralFromValue(operation.prebuild.document),
          t.tsTypeReference(t.tsQualifiedName(t.identifier("graphql"), t.identifier("DocumentNode"))),
        ),
        variableNames: t.arrayExpression(operation.prebuild.variableNames.map((variableName) => t.stringLiteral(variableName))),
        projectionPathGraph: projectionGraphToAst(operation.prebuild.projectionPathGraph),
      }),
      runtime: buildObjectExpression<keyof RuntimeOperationInput["runtime"]>({
        getSlices: clone(slicesBuilder),
      }),
    }),
  ]);

  const referenceCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("getOperation")), [
    t.stringLiteral(operation.prebuild.operationName),
  ]);

  return {
    referenceCall,
    runtimeCall,
  };
};

export const createPlugin = (): PluginObj<SodaGqlBabelOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  pre() {
    const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};
    const optionsResult = normalizeOptions(rawOptions);
    if (!optionsResult.isOk()) {
      throw new Error(optionsResult.error.message);
    }
    const options = optionsResult.value;

    const artifactResult = loadArtifact(options.artifactsPath);
    if (!artifactResult.isOk()) {
      const errorCode =
        artifactResult.error.code === "NOT_FOUND"
          ? "SODA_GQL_ARTIFACT_NOT_FOUND"
          : `SODA_GQL_ARTIFACT_${artifactResult.error.code}`;
      throw new Error(errorCode);
    }
    const artifact = artifactResult.value;

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

      const runtimeCalls: t.Expression[] = [];
      let mutated = false;

      programPath.traverse({
        CallExpression(callPath) {
          const gqlCall = extractGqlCall(callPath, filename);
          if (!gqlCall) {
            return;
          }

          ensureGqlRuntimeImport(programPath);

          if (gqlCall.builderName === "model") {
            const replacement = buildModelRuntimeCall(gqlCall, pluginState);
            callPath.replaceWith(replacement);
            mutated = true;
            return;
          }

          if (["querySlice", "mutationSlice", "subscriptionSlice"].includes(gqlCall.builderName)) {
            const replacement = buildSliceRuntimeCall(gqlCall, pluginState, filename);
            callPath.replaceWith(replacement);
            mutated = true;
            return;
          }

          if (["query", "mutation", "subscription"].includes(gqlCall.builderName)) {
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

            const { referenceCall, runtimeCall } = buildOperationRuntimeComponents(gqlCall, pluginState);

            callPath.replaceWith(referenceCall);
            runtimeCalls.push(runtimeCall);
            mutated = true;
            return;
          }
        },
      });

      if (runtimeCalls.length > 0) {
        programPath.traverse({
          ImportDeclaration(importDeclPath) {
            if (importDeclPath.node.source.value === "@soda-gql/runtime") {
              importDeclPath.insertAfter(runtimeCalls);
            }
          },
        });
      }

      if (mutated) {
        programPath.scope.crawl();
        maybeRemoveUnusedGqlImport(programPath);
      }
    },
  },
});
