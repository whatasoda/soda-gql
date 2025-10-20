import {
  createPluginRuntimeFromNormalized,
  formatPluginError,
  getCoordinator,
  type PluginRuntime,
  preparePluginState,
  registerConsumer,
} from "@soda-gql/plugin-shared";
import type { Compiler, WebpackPluginInstance } from "webpack";
import { registerCompilerHooks } from "./hooks";
import { DiagnosticsReporter } from "./internal/diagnostics";
import { type ArtifactManifest, createArtifactManifest, manifestChanged } from "./internal/manifest";
import type { DiagnosticsMode, WebpackPluginOptions } from "./schemas/options";
import { webpackPluginOptionsSchema } from "./schemas/options";

const PLUGIN_NAME = "SodaGqlWebpackPlugin";
const DIAGNOSTICS_ASSET_NAME = "soda-gql.diagnostics.json";

const toWebpackError = (failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure): Error => {
  if (failure.type === "builder-error") {
    return new Error(`[@soda-gql/plugin-webpack] ${failure.error.code}: ${failure.error.message}`);
  }

  const message =
    failure.error instanceof Error
      ? failure.error.message
      : typeof failure.error === "string"
        ? failure.error
        : "Unexpected error";
  const error = new Error(`[@soda-gql/plugin-webpack] Unexpected builder failure: ${message}`);
  if (failure.error instanceof Error) {
    (error as Error & { cause?: unknown }).cause = failure.error;
  }
  return error;
};

export class SodaGqlWebpackPlugin implements WebpackPluginInstance {
  private readonly rawOptions: Partial<WebpackPluginOptions>;

  constructor(options: Partial<WebpackPluginOptions> = {}) {
    this.rawOptions = options;
  }

  apply(compiler: Compiler): void {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    // Parse options early
    const parsed = webpackPluginOptionsSchema.parse({
      ...this.rawOptions,
    });

    const diagnosticsMode: DiagnosticsMode = parsed.diagnostics;
    const bailOnError = parsed.bailOnError;

    // Create diagnostics reporter
    const diagnostics = new DiagnosticsReporter(diagnosticsMode, logger);

    // Initialize state asynchronously (exclude webpack-specific options)
    const statePromise = preparePluginState({
      configPath: this.rawOptions.configPath,
      project: this.rawOptions.project,
      importIdentifier: this.rawOptions.importIdentifier,
      diagnostics: diagnosticsMode === "off" ? undefined : diagnosticsMode,
    });

    let runtime: PluginRuntime | null = null;
    let manifest: ArtifactManifest | null = null;
    let consumerRelease: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;

    // Helper to handle runtime.refresh() errors
    const refreshRuntimeOrReport = async (rt: PluginRuntime): Promise<void> => {
      const refreshResult = await rt.refresh();

      if (refreshResult.isErr()) {
        const pluginError = refreshResult.error;
        const failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure = {
          type: "unexpected-error",
          error: new Error(formatPluginError(pluginError)),
        };

        diagnostics.recordError(failure);

        if (bailOnError) {
          throw toWebpackError(failure);
        }
      }
    };

    const initializeCoordinator = async (): Promise<void> => {
      const stateResult = await statePromise;

      if (stateResult.isErr()) {
        const failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure = {
          type: "unexpected-error",
          error: new Error(formatPluginError(stateResult.error)),
        };
        diagnostics.recordError(failure);
        if (bailOnError) {
          throw toWebpackError(failure);
        }
        return;
      }

      const state = stateResult.value;
      const coordinator = getCoordinator(state.coordinatorKey);

      if (!coordinator) {
        const failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure = {
          type: "unexpected-error",
          error: new Error("Coordinator not found"),
        };
        diagnostics.recordError(failure);
        if (bailOnError) {
          throw toWebpackError(failure);
        }
        return;
      }

      // Register as consumer
      const consumer = registerConsumer(state.coordinatorKey);
      consumerRelease = () => consumer.release();

      // Create runtime
      runtime = await createPluginRuntimeFromNormalized(state.options);

      // Initialize diagnostics with initial snapshot
      const initialSnapshot = state.snapshot;
      diagnostics.recordSuccess(initialSnapshot.artifact);
      manifest = createArtifactManifest(initialSnapshot.artifact);

      // Subscribe to coordinator updates
      unsubscribe = coordinator.subscribe((event) => {
        if (event.type === "artifact") {
          const nextArtifact = event.snapshot.artifact;
          diagnostics.recordSuccess(nextArtifact);

          const nextManifest = createArtifactManifest(nextArtifact);
          const changed = manifestChanged(manifest, nextManifest);
          manifest = nextManifest;

          if (changed && runtime) {
            void refreshRuntimeOrReport(runtime);
          }
        } else if (event.type === "error") {
          // Convert unknown error to BuilderServiceFailure
          const failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure = {
            type: "unexpected-error",
            error: event.error instanceof Error ? event.error : new Error(String(event.error)),
          };
          diagnostics.recordError(failure);
          if (bailOnError) {
            logger.error(toWebpackError(failure).message);
          }
        }
      });
    };

    const triggerIncrementalBuild = async (): Promise<void> => {
      const stateResult = await statePromise;
      if (stateResult.isErr()) {
        return;
      }

      const state = stateResult.value;
      const coordinator = getCoordinator(state.coordinatorKey);

      if (!coordinator) {
        return;
      }

      try {
        // ensureLatest() triggers build, tracker auto-detects file changes
        await coordinator.ensureLatest();
      } catch (error) {
        const failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure = {
          type: "unexpected-error",
          error: error instanceof Error ? error : new Error(String(error)),
        };
        diagnostics.recordError(failure);
        if (bailOnError) {
          throw toWebpackError(failure);
        }
      }
    };

    registerCompilerHooks(compiler, {
      pluginName: PLUGIN_NAME,
      run: async () => {
        try {
          await initializeCoordinator();
        } catch (error) {
          if (error instanceof Error) {
            logger.error(error.message);
          }
        }
      },
      watchRun: async ({ modifiedFiles, removedFiles }) => {
        try {
          // Ensure coordinator is initialized
          if (!runtime) {
            await initializeCoordinator();
          }

          // Trigger incremental build when Webpack reports file changes
          // The builder's file tracker will detect the actual changes
          if ((modifiedFiles && modifiedFiles.size > 0) || (removedFiles && removedFiles.size > 0)) {
            await triggerIncrementalBuild();
          }
        } catch (error) {
          if (error instanceof Error) {
            logger.error(error.message);
          }
        }
      },
      onInvalid: () => {
        // No-op: tracker maintains its own state
      },
      onWatchClose: () => {
        unsubscribe?.();
        consumerRelease?.();
        runtime?.dispose();
      },
    });

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const failure = diagnostics.getFailure();
      if (failure) {
        compilation.errors.push(
          failure.code
            ? new Error(`[@soda-gql/plugin-webpack] ${failure.code}: ${failure.message}`)
            : new Error(`[@soda-gql/plugin-webpack] ${failure.message}`),
        );
      }

      if (diagnosticsMode === "json") {
        compilation.hooks.processAssets.tap(
          {
            name: PLUGIN_NAME,
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
          },
          () => {
            const summary = diagnostics.getSummary();
            if (!summary) {
              return;
            }
            const { RawSource } = compiler.webpack.sources;
            compilation.emitAsset(DIAGNOSTICS_ASSET_NAME, new RawSource(`${JSON.stringify(summary, null, 2)}\n`));
          },
        );
      }
    });
  }
}
