import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { CanonicalId } from "@soda-gql/builder";
import { babelTransformAdapterFactory } from "./adapter/index";
import { type PluginOptions, type PluginState, preparePluginState } from "./internal/builder-bridge";
import { formatPluginError } from "./internal/errors";

type PluginPassState = PluginPass & {
  _state?: PluginState;
};

export const createSodaGqlPlugin = (): PluginObj<PluginOptions & { _state?: PluginState }> => ({
  name: "@soda-gql/plugin-babel",
  // NOTE: async pre() requires Babel async APIs (transformAsync, loadPartialConfigAsync)
  async pre() {
    const rawOptions = (this as unknown as { opts?: Partial<PluginOptions> }).opts ?? {};
    const stateResult = await preparePluginState(rawOptions);

    if (stateResult.isErr()) {
      throw new Error(formatPluginError(stateResult.error));
    }

    const normalizedState = stateResult.value;

    // Store state for transform
    this._state = normalizedState;
  },
  visitor: {
    Program(programPath: NodePath<t.Program>, state) {
      const pass = state as unknown as PluginPassState;
      const pluginState = pass._state;
      if (!pluginState) {
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
        artifactLookup: (canonicalId: CanonicalId) => pluginState.allArtifacts[canonicalId],
        runtimeModule: pluginState.options.importIdentifier,
      });

      // Insert runtime side effects if transformed
      if (result.transformed) {
        adapter.insertRuntimeSideEffects(
          {
            filename,
            runtimeModule: pluginState.options.importIdentifier,
            artifactLookup: (canonicalId: CanonicalId) => pluginState.allArtifacts[canonicalId],
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
