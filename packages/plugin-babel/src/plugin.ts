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
import { ensureGqlRuntimeImport, maybeRemoveUnusedGqlImport } from "./transform/import-utils";
import {
  buildModelRuntimeCall,
  buildOperationRuntimeComponents,
  buildSliceRuntimeCall,
} from "./transform/runtime-builders";
import type { SodaGqlBabelOptions } from "./types";

type PluginPassState = PluginPass & { _state?: PluginState };

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
