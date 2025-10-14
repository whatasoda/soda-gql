import type { PluginObj, PluginPass } from "@babel/core";
import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { PluginOptions } from "@soda-gql/plugin-shared";
import { formatPluginError, type PluginState, preparePluginState } from "@soda-gql/plugin-shared";
import { babelTransformAdapterFactory } from "./adapter";
import { type DevManager, type DevManagerContext, getDevManager, type StateStore } from "./dev";

type PluginPassState = PluginPass & {
  _state?: PluginState;
  _dev?: { manager: DevManager; stateStore: StateStore };
};

export const createSodaGqlPlugin = (): PluginObj<
  PluginOptions & { _state?: PluginState; _dev?: { manager: DevManager; stateStore: StateStore } }
> => ({
  name: "@soda-gql/plugin-babel",
  // NOTE: async pre() requires Babel async APIs (transformAsync, loadPartialConfigAsync)
  // Sync transforms are unsupported for builder artifact source mode
  async pre() {
    const rawOptions = (this as unknown as { opts?: Partial<PluginOptions> }).opts ?? {};
    const stateResult = await preparePluginState(rawOptions);

    if (stateResult.isErr()) {
      throw new Error(formatPluginError(stateResult.error));
    }

    const normalizedState = stateResult.value;

    // Detect dev mode: explicit option or environment variable
    const isDevMode =
      (rawOptions.dev?.hmr === true || process.env.SODA_GQL_DEV?.toLowerCase() === "true") &&
      normalizedState.options.artifact.type === "builder";

    if (isDevMode) {
      // Dev mode: use DevManager for HMR support
      try {
        const config = normalizedState.options.artifact.config;
        const options = normalizedState.options;

        // Create context for this project
        const managerContext: DevManagerContext = {
          configPath: options.resolvedConfig.configPath,
          projectRoot: options.resolvedConfig.configDir,
          schemaHash: options.resolvedConfig.configHash,
        };

        const manager = getDevManager(managerContext);

        // Get initial artifact from provider
        if (!normalizedState.artifactProvider) {
          throw new Error("Artifact provider not available in dev mode");
        }
        const initialArtifactResult = await normalizedState.artifactProvider.load();
        if (initialArtifactResult.isErr()) {
          throw new Error(formatPluginError(initialArtifactResult.error));
        }
        const initialArtifact = initialArtifactResult.value;

        // Construct watch options from resolved config
        const watchOptions = config.config.builder.analyzer
          ? {
              rootDir: config.config.configDir,
              schemaHash: config.config.configHash,
              analyzerVersion: config.config.builder.analyzer,
            }
          : null;

        // Initialize manager if not already initialized
        await manager.ensureInitialized({
          config,
          options,
          watchOptions,
          initialArtifact,
        });

        // Get state store and snapshot
        const stateStore = manager.getStateStore();
        const snapshot = stateStore.getSnapshot();

        if (snapshot.status === "error") {
          throw new Error(`Dev mode initialization failed: ${snapshot.error.message}`);
        }

        this._state = snapshot.state;
        this._dev = { manager, stateStore };
      } catch (error) {
        // Try to format as PluginError if possible, otherwise use error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(errorMessage);
      }
    } else {
      // Production mode: use static state
      this._state = normalizedState;
    }
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
