import type { PluginObj, PluginPass, types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { ArtifactLookup } from "./analysis/gql-call";
import { collectGqlDefinitionMetadata } from "./metadata/collector";
import { type PluginState, preparePluginState } from "./state";
import { ensureGqlRuntimeImport, maybeRemoveUnusedGqlImport } from "./transform/import-utils";
import { insertRuntimeCalls, transformCallExpression } from "./transform/transformer";
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

      const metadata = collectGqlDefinitionMetadata({ programPath, filename });
      const getArtifact: ArtifactLookup = (canonicalId) => pluginState.allArtifacts[canonicalId];

      const runtimeCalls: t.Expression[] = [];
      let mutated = false;

      programPath.traverse({
        CallExpression(callPath) {
          const result = transformCallExpression({
            callPath,
            filename,
            metadata,
            getArtifact,
          });

          if (result.transformed) {
            ensureGqlRuntimeImport(programPath);
            mutated = true;

            if (result.runtimeCall) {
              runtimeCalls.push(result.runtimeCall);
            }
          }
        },
      });

      insertRuntimeCalls(programPath, runtimeCalls);

      if (mutated) {
        programPath.scope.crawl();
        maybeRemoveUnusedGqlImport(programPath);
      }
    },
  },
});
