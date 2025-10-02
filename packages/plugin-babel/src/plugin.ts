import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type {
  BuilderArtifactEntry,
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
  CanonicalId,
  CanonicalPathTracker,
} from "@soda-gql/builder";
import { createCanonicalTracker } from "@soda-gql/builder";
import type { RuntimeModelInput } from "../../core/src/runtime/model";
import type { RuntimeOperationInput } from "../../core/src/runtime/operation";
import type { RuntimeSliceInput } from "../../core/src/runtime/slice";
import { resolveCanonicalId } from "./artifact";
import { type PluginState, preparePluginState } from "./state";
import { buildObjectExpression, clone } from "./transform/ast-builders";
import type { SodaGqlBabelOptions } from "./types";

type AllArtifacts = Record<CanonicalId, BuilderArtifactEntry>;

type PluginPassState = PluginPass & { _state?: PluginState };

/**
 * Metadata collected for each gql definition
 */
type GqlDefinitionMetadata = {
  readonly astPath: string;
  readonly isTopLevel: boolean;
  readonly isExported: boolean;
  readonly exportBinding?: string;
};

/**
 * Collect metadata for all gql definitions in the program
 * Returns a WeakMap from CallExpression nodes to their metadata
 */
const collectGqlDefinitionMetadata = (
  programPath: NodePath<t.Program>,
  filename: string,
): WeakMap<t.CallExpression, GqlDefinitionMetadata> => {
  const metadata = new WeakMap<t.CallExpression, GqlDefinitionMetadata>();

  // Build export bindings map
  const exportBindings = new Map<string, string>();
  programPath.node.body.forEach((statement) => {
    if (t.isExportNamedDeclaration(statement) && statement.declaration) {
      if (t.isVariableDeclaration(statement.declaration)) {
        statement.declaration.declarations.forEach((declarator) => {
          if (t.isIdentifier(declarator.id)) {
            exportBindings.set(declarator.id.name, declarator.id.name);
          }
        });
      } else if (
        (t.isFunctionDeclaration(statement.declaration) || t.isClassDeclaration(statement.declaration)) &&
        statement.declaration.id
      ) {
        exportBindings.set(statement.declaration.id.name, statement.declaration.id.name);
      }
    }
  });

  // Create canonical tracker
  const tracker = createCanonicalTracker({
    filePath: filename,
    getExportName: (localName) => exportBindings.get(localName),
  });

  // Anonymous scope counters
  const anonymousCounters = new Map<string, number>();
  const getAnonymousName = (kind: string): string => {
    const count = anonymousCounters.get(kind) ?? 0;
    anonymousCounters.set(kind, count + 1);
    return `${kind}#${count}`;
  };

  // Track scope handles for proper enter/exit pairing
  const scopeHandles = new WeakMap<NodePath, ReturnType<CanonicalPathTracker["enterScope"]>>();

  const isGqlCall = (node: t.Node): node is t.CallExpression => {
    return (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object, { name: "gql" }) &&
      node.arguments.length > 0 &&
      t.isArrowFunctionExpression(node.arguments[0])
    );
  };

  programPath.traverse({
    enter(path) {
      // Check if this is a gql definition call
      if (path.isCallExpression() && isGqlCall(path.node)) {
        const { astPath } = tracker.registerDefinition();
        const isTopLevel = tracker.currentDepth() === 0;

        let isExported = false;
        let exportBinding: string | undefined;

        if (isTopLevel && path.parentPath?.isVariableDeclarator()) {
          const declarator = path.parentPath;
          if (t.isIdentifier(declarator.node.id)) {
            const topLevelName = declarator.node.id.name;
            if (exportBindings.has(topLevelName)) {
              isExported = true;
              exportBinding = exportBindings.get(topLevelName);
            }
          }
        }

        metadata.set(path.node, {
          astPath,
          isTopLevel,
          isExported,
          exportBinding,
        });
        // Skip traversing children of gql calls (like the builder does)
        path.skip();
        return;
      }

      // Variable declarator
      if (path.isVariableDeclarator() && path.node.id && t.isIdentifier(path.node.id)) {
        const varName = path.node.id.name;
        const handle = tracker.enterScope({ segment: varName, kind: "variable", stableKey: `var:${varName}` });
        scopeHandles.set(path, handle);
        return;
      }

      // Arrow function
      if (path.isArrowFunctionExpression()) {
        const arrowName = getAnonymousName("arrow");
        const handle = tracker.enterScope({ segment: arrowName, kind: "function", stableKey: "arrow" });
        scopeHandles.set(path, handle);
        return;
      }

      // Function declaration
      if (path.isFunctionDeclaration()) {
        const funcName = path.node.id?.name ?? getAnonymousName("function");
        const handle = tracker.enterScope({ segment: funcName, kind: "function", stableKey: `func:${funcName}` });
        scopeHandles.set(path, handle);
        return;
      }

      // Function expression
      if (path.isFunctionExpression()) {
        const funcName = path.node.id?.name ?? getAnonymousName("function");
        const handle = tracker.enterScope({ segment: funcName, kind: "function", stableKey: `func:${funcName}` });
        scopeHandles.set(path, handle);
        return;
      }

      // Class declaration
      if (path.isClassDeclaration()) {
        const className = path.node.id?.name ?? getAnonymousName("class");
        const handle = tracker.enterScope({ segment: className, kind: "class", stableKey: `class:${className}` });
        scopeHandles.set(path, handle);
        return;
      }

      // Class method
      if (path.isClassMethod() && t.isIdentifier(path.node.key)) {
        const memberName = path.node.key.name;
        const handle = tracker.enterScope({ segment: memberName, kind: "method", stableKey: `member:${memberName}` });
        scopeHandles.set(path, handle);
        return;
      }

      // Class property
      if (path.isClassProperty() && t.isIdentifier(path.node.key)) {
        const memberName = path.node.key.name;
        const handle = tracker.enterScope({ segment: memberName, kind: "property", stableKey: `member:${memberName}` });
        scopeHandles.set(path, handle);
        return;
      }

      // Object property
      if (path.isObjectProperty()) {
        let propName: string | null = null;
        if (t.isIdentifier(path.node.key)) {
          propName = path.node.key.name;
        } else if (t.isStringLiteral(path.node.key)) {
          propName = path.node.key.value;
        }

        if (propName) {
          const handle = tracker.enterScope({ segment: propName, kind: "property", stableKey: `prop:${propName}` });
          scopeHandles.set(path, handle);
        }
        return;
      }
    },

    exit(path) {
      // Exit scope when exiting nodes that have handles
      const handle = scopeHandles.get(path);
      if (handle) {
        tracker.exitScope(handle);
        scopeHandles.delete(path);
      }
    },
  });

  return metadata;
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

const _collectCalleeSegments = (callee: t.Expression): readonly string[] => {
  if (t.isIdentifier(callee)) {
    return [callee.name];
  }

  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) {
    const objectSegments = _collectCalleeSegments(callee.object as t.Expression);
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

type GqlCallBase = {
  nodePath: NodePath<t.CallExpression>;
  canonicalId: CanonicalId;
  builderCall: t.CallExpression;
};

type GqlCall = GqlCallModel | GqlCallSlice | GqlCallOperation;
type GqlCallModel = GqlCallBase & { type: "model"; artifact: BuilderArtifactModel };
type GqlCallSlice = GqlCallBase & { type: "slice"; artifact: BuilderArtifactSlice };
type GqlCallOperation = GqlCallBase & { type: "operation"; artifact: BuilderArtifactOperation };

/**
 * Check if this is a call to gql.${schema}(({ ${method} }) => ${method}(...))
 * Uses metadata collected upfront instead of deriving export names
 */
const extractGqlCall = ({
  nodePath,
  filename,
  artifacts,
  metadata,
}: {
  nodePath: NodePath<t.CallExpression>;
  filename: string;
  artifacts: AllArtifacts;
  metadata: WeakMap<t.CallExpression, GqlDefinitionMetadata>;
}): GqlCall | null => {
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

  // Get metadata collected upfront
  const meta = metadata.get(node);
  if (!meta) {
    throw new Error("SODA_GQL_METADATA_NOT_FOUND");
  }

  // Use astPath to build canonical ID
  const canonicalId = resolveCanonicalId(filename, meta.astPath);

  const artifact = artifacts[canonicalId];
  if (!artifact) {
    throw new Error("SODA_GQL_ARTIFACT_NOT_FOUND");
  }

  const base: GqlCallBase = { nodePath, canonicalId, builderCall };

  if (artifact.type === "model") {
    return { ...base, type: "model", artifact } satisfies GqlCallModel;
  }

  if (artifact.type === "slice") {
    return { ...base, type: "slice", artifact } satisfies GqlCallSlice;
  }

  if (artifact.type === "operation") {
    return { ...base, type: "operation", artifact } satisfies GqlCallOperation;
  }

  void (artifact satisfies never);
  throw new Error("SODA_GQL_ARTIFACT_NOT_FOUND");
};

const buildModelRuntimeCall = ({ artifact, builderCall }: GqlCallModel): t.Expression => {
  const [, , normalize] = builderCall.arguments;
  if (!normalize || !t.isExpression(normalize)) {
    throw new Error("gql.model requires a transform");
  }

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("model")), [
    buildObjectExpression({
      prebuild: buildObjectExpression<keyof RuntimeModelInput["prebuild"]>({
        typename: t.stringLiteral(artifact.prebuild.typename),
      }),
      runtime: buildObjectExpression<keyof RuntimeModelInput["runtime"]>({
        normalize: clone(normalize),
      }),
    }),
  ]);
};

const buildSliceRuntimeCall = ({ artifact, builderCall }: GqlCallSlice): t.Expression => {
  const [, , projectionBuilder] = builderCall.arguments;
  if (!projectionBuilder || !t.isExpression(projectionBuilder)) {
    throw new Error("gql.querySlice requires a projection builder");
  }

  return t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("slice")), [
    buildObjectExpression({
      prebuild: buildObjectExpression<keyof RuntimeSliceInput["prebuild"]>({
        operationType: t.stringLiteral(artifact.prebuild.operationType),
      }),
      runtime: buildObjectExpression<keyof RuntimeSliceInput["runtime"]>({
        buildProjection: clone(projectionBuilder),
      }),
    }),
  ]);
};

const buildOperationRuntimeComponents = ({ artifact, builderCall }: GqlCallOperation) => {
  const [, slicesBuilder] = builderCall.arguments;
  if (!slicesBuilder || !t.isExpression(slicesBuilder)) {
    throw new Error("gql.query requires a name, variables, and slices builder");
  }

  const runtimeCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("operation")), [
    buildObjectExpression({
      prebuild: t.callExpression(t.memberExpression(t.identifier("JSON"), t.identifier("parse")), [
        t.stringLiteral(JSON.stringify(artifact.prebuild)),
      ]),
      runtime: buildObjectExpression<keyof RuntimeOperationInput["runtime"]>({
        getSlices: clone(slicesBuilder),
      }),
    }),
  ]);

  const referenceCall = t.callExpression(t.memberExpression(t.identifier("gqlRuntime"), t.identifier("getOperation")), [
    t.stringLiteral(artifact.prebuild.operationName),
  ]);

  return {
    referenceCall,
    runtimeCall,
  };
};

export const createPlugin = (): PluginObj<SodaGqlBabelOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  // NOTE: async pre() requires Babel async APIs (transformAsync, loadPartialConfigAsync)
  // Sync transforms are unsupported for builder artifact source mode
  async pre() {
    const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};
    const stateResult = await preparePluginState(rawOptions);

    if (stateResult.isErr()) {
      throw new Error(stateResult.error.message);
    }

    this._state = stateResult.value;
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

      // Collect metadata for all gql definitions upfront
      const metadata = collectGqlDefinitionMetadata(programPath, filename);

      const runtimeCalls: t.Expression[] = [];
      let mutated = false;

      programPath.traverse({
        CallExpression(callPath) {
          const gqlCall = extractGqlCall({ nodePath: callPath, filename, artifacts: pluginState.allArtifacts, metadata });
          if (!gqlCall) {
            return;
          }

          ensureGqlRuntimeImport(programPath);

          if (gqlCall.type === "model") {
            const replacement = buildModelRuntimeCall(gqlCall);
            callPath.replaceWith(replacement);
            mutated = true;
            return;
          }

          if (gqlCall.type === "slice") {
            const replacement = buildSliceRuntimeCall(gqlCall);
            callPath.replaceWith(replacement);
            mutated = true;
            return;
          }

          if (gqlCall.type === "operation") {
            const { referenceCall, runtimeCall } = buildOperationRuntimeComponents(gqlCall);
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
