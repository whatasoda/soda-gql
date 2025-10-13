import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { formatPluginError, type PluginState, preparePluginState } from "@soda-gql/plugin-shared";
import { babelTransformAdapterFactory } from "./adapter/babel/adapter";
import type { SodaGqlBabelOptions } from "./types";

type PluginPassState = PluginPass & { _state?: PluginState };

export const createSodaGqlPlugin = (): PluginObj<SodaGqlBabelOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  // NOTE: async pre() requires Babel async APIs (transformAsync, loadPartialConfigAsync)
  // Sync transforms are unsupported for builder artifact source mode
  async pre() {
    const rawOptions = (this as unknown as { opts?: Partial<SodaGqlBabelOptions> }).opts ?? {};
    const stateResult = await preparePluginState(rawOptions);

    if (stateResult.isErr()) {
      throw new Error(formatPluginError(stateResult.error));
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

      // Create Babel adapter instance
      const adapter = babelTransformAdapterFactory.create({
        programPath,
        types: t,
      });

      // Transform using adapter
      const result = adapter.transformProgram({
        filename,
        artifactLookup: (canonicalId) => pluginState.allArtifacts[canonicalId],
      });

      // Insert runtime side effects if transformed
      if (result.transformed) {
        adapter.insertRuntimeSideEffects(
          {
            filename,
            artifactLookup: (canonicalId) => pluginState.allArtifacts[canonicalId],
          },
          result.runtimeArtifacts || [],
        );
      }

      // Handle errors
      if (result.errors && result.errors.length > 0) {
        const firstError = result.errors[0];
        if (firstError) {
          throw new Error(formatPluginError(firstError));
        }
      }
    },
  },
});
