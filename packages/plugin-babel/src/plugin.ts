import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { CanonicalId } from "@soda-gql/builder";
import {
  extractGqlCall,
  findGqlBuilderCall,
  type ArtifactLookup,
} from "./analysis/gql-call";
import { collectGqlDefinitionMetadata } from "./metadata/collector";
import { type PluginState, preparePluginState } from "./state";
import {
  buildModelRuntimeCall,
  buildOperationRuntimeComponents,
  buildSliceRuntimeCall,
} from "./transform/runtime-builders";
import type { SodaGqlBabelOptions } from "./types";

type PluginPassState = PluginPass & { _state?: PluginState };

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
      const metadata = collectGqlDefinitionMetadata({ programPath, filename });

      const runtimeCalls: t.Expression[] = [];
      let mutated = false;
      const getArtifact: ArtifactLookup = (canonicalId) => pluginState.allArtifacts[canonicalId];

      programPath.traverse({
        CallExpression(callPath) {
          const builderCall = findGqlBuilderCall(callPath);
          if (!builderCall) {
            return;
          }

          const gqlCallResult = extractGqlCall({
            nodePath: callPath,
            filename,
            metadata,
            builderCall,
            getArtifact,
          });

          if (gqlCallResult.isErr()) {
            throw new Error(gqlCallResult.error.message);
          }

          const gqlCall = gqlCallResult.value;

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
