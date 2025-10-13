import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import type { BuilderArtifact, BuilderChangeSet, BuilderServiceConfig } from "@soda-gql/builder";
import { invalidateArtifactCache, createPluginRuntimeFromNormalized, type PluginRuntime } from "@soda-gql/plugin-shared";
import {
  createBuilderServiceController,
  createBuilderWatch,
  type DevBuilderSessionLike,
} from "@soda-gql/plugin-shared/dev";
import type { Compiler, WebpackPluginInstance } from "webpack";
import { DiagnosticsReporter } from "../internal/diagnostics.js";
import { type ArtifactManifest, createArtifactManifest, manifestChanged } from "../internal/manifest.js";
import type { DiagnosticsMode, WebpackPluginOptions } from "../schemas/webpack.js";
import { webpackPluginOptionsSchema } from "../schemas/webpack.js";
import { registerCompilerHooks } from "./hooks.js";

const PLUGIN_NAME = "SodaGqlWebpackPlugin";
const DIAGNOSTICS_ASSET_NAME = "soda-gql.diagnostics.json";

// Module-level runtime cache shared across plugin instances
const runtimeCache = new Map<string, Promise<PluginRuntime>>();

type BuilderSourceConfig = {
  readonly source: "builder";
  readonly config: BuilderServiceConfig;
};

type ArtifactFileSourceConfig = {
  readonly source: "artifact-file";
  readonly path: string;
};

type NormalizedOptions = {
  readonly contextDir: string;
  readonly artifactPath: string;
  readonly artifactSource: BuilderSourceConfig | ArtifactFileSourceConfig;
  readonly diagnostics: DiagnosticsMode;
  readonly bailOnError: boolean;
  readonly mode: WebpackPluginOptions["mode"];
};

const ensureAbsolutePath = (contextDir: string, value: string): string => {
  return normalize(isAbsolute(value) ? value : resolve(contextDir, value));
};

const collectChangedFiles = (contextDir: string, sets: Array<ReadonlySet<string> | undefined>): Set<string> => {
  const result = new Set<string>();
  for (const set of sets) {
    if (!set) continue;
    for (const file of set) {
      result.add(ensureAbsolutePath(contextDir, file));
    }
  }
  return result;
};

const persistArtifact = async (artifactPath: string, artifact: BuilderArtifact): Promise<void> => {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
};

const toWebpackError = (failure: import("@soda-gql/plugin-shared/dev").BuilderServiceFailure): Error => {
  if (failure.type === "builder-error") {
    return new Error(`[${PLUGIN_NAME}] ${failure.error.code}: ${failure.error.message}`);
  }

  const message =
    failure.error instanceof Error
      ? failure.error.message
      : typeof failure.error === "string"
        ? failure.error
        : "Unexpected error";
  const error = new Error(`[${PLUGIN_NAME}] Unexpected builder failure: ${message}`);
  if (failure.error instanceof Error) {
    (error as Error & { cause?: unknown }).cause = failure.error;
  }
  return error;
};

const getOrCreateRuntime = async (artifactPath: string, mode: "runtime" | "zero-runtime"): Promise<PluginRuntime> => {
  const key = JSON.stringify({ artifactPath, mode });

  let promise = runtimeCache.get(key);
  if (!promise) {
    promise = (async () => {
      const { normalizePluginOptions } = await import("@soda-gql/plugin-shared");
      const optionsResult = await normalizePluginOptions({
        mode,
        artifact: { useBuilder: false, path: artifactPath },
      });

      if (optionsResult.isErr()) {
        throw new Error(`Failed to normalize runtime options: ${optionsResult.error.message}`);
      }

      return createPluginRuntimeFromNormalized(optionsResult.value);
    })();
    runtimeCache.set(key, promise);
  }

  return promise;
};

const normalizeOptions = (compiler: Compiler, raw: Partial<WebpackPluginOptions>): NormalizedOptions => {
  const contextDir = compiler.context ?? compiler.options.context ?? process.cwd();

  const parsed = webpackPluginOptionsSchema.parse({
    mode: raw.mode ?? "runtime",
    ...raw,
  });

  let artifactPath = parsed.artifactPath ? ensureAbsolutePath(contextDir, parsed.artifactPath) : "";
  let artifactSource: BuilderSourceConfig | ArtifactFileSourceConfig | null = null;

  if (parsed.artifactSource?.source === "artifact-file") {
    const resolved = ensureAbsolutePath(contextDir, parsed.artifactSource.path);
    artifactSource = { source: "artifact-file", path: resolved };
    if (!artifactPath) {
      artifactPath = resolved;
    }
  } else if (parsed.artifactSource?.source === "builder") {
    const configInput = parsed.artifactSource.config as unknown as BuilderServiceConfig;
    const normalizedEntry = configInput.entry.map((entry) => ensureAbsolutePath(contextDir, entry));
    const builderConfig: BuilderServiceConfig = {
      ...configInput,
      mode: configInput.mode ?? parsed.mode,
      entry: normalizedEntry,
    };
    artifactSource = { source: "builder", config: builderConfig };
  } else if (artifactPath) {
    artifactSource = { source: "artifact-file", path: artifactPath };
  }

  if (!artifactSource) {
    throw new Error(`[${PLUGIN_NAME}] artifactSource or artifactPath must be provided`);
  }

  if (!artifactPath) {
    artifactPath =
      artifactSource.source === "artifact-file"
        ? artifactSource.path
        : ensureAbsolutePath(contextDir, join(".soda-gql", "artifacts", "artifact.json"));
  }

  return {
    contextDir,
    artifactPath,
    artifactSource,
    diagnostics: parsed.diagnostics,
    bailOnError: parsed.bailOnError ?? false,
    mode: parsed.mode,
  };
};

export class SodaGqlWebpackPlugin implements WebpackPluginInstance {
  private readonly rawOptions: Partial<WebpackPluginOptions>;

  constructor(options: Partial<WebpackPluginOptions> = {}) {
    this.rawOptions = options;
  }

  apply(compiler: Compiler): void {
    const options = normalizeOptions(compiler, this.rawOptions);
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
    const diagnostics = new DiagnosticsReporter(options.diagnostics, logger);

    const runtimePromise = getOrCreateRuntime(options.artifactPath, options.mode);

    const builderSource = options.artifactSource.source === "builder" ? options.artifactSource : null;
    const builderController = builderSource ? createBuilderServiceController(builderSource.config) : null;
    const builderWatch = builderSource
      ? createBuilderWatch({
          rootDir: options.contextDir,
          schemaHash: builderSource.config.schemaHash,
          analyzerVersion: builderSource.config.analyzer ?? "ts",
        })
      : null;

    let manifest: ArtifactManifest | null = null;

    const handleResult = async (result: import("@soda-gql/plugin-shared/dev").BuilderServiceResult): Promise<void> => {
      if (result.isErr()) {
        diagnostics.recordError(result.error);
        if (options.bailOnError) {
          throw toWebpackError(result.error);
        }
        return;
      }

      const artifact = result.value;
      diagnostics.recordSuccess(artifact);

      const nextManifest = createArtifactManifest(artifact);
      const changed = manifestChanged(manifest, nextManifest);
      manifest = nextManifest;

      if (changed) {
        await persistArtifact(options.artifactPath, artifact);
        invalidateArtifactCache(options.artifactPath);
        const runtime = await runtimePromise;
        await runtime.refresh();
      }
    };

    const runInitialBuild = async (): Promise<void> => {
      if (!builderController || builderController.initialized) {
        return;
      }
      await handleResult(await builderController.build());
    };

    const runIncrementalBuild = async (changeSet: BuilderChangeSet): Promise<void> => {
      if (!builderController) {
        return;
      }
      await handleResult(await builderController.update(changeSet));
    };

    const handleArtifactFileChange = async (changed: Set<string>): Promise<void> => {
      if (!changed.has(options.artifactPath)) {
        return;
      }
      invalidateArtifactCache(options.artifactPath);
      const runtime = await runtimePromise;
      await runtime.refresh();
    };

    registerCompilerHooks(compiler, {
      pluginName: PLUGIN_NAME,
      run: async () => {
        await runtimePromise; // Ensure runtime is ready
        if (builderController) {
          await runInitialBuild();
        } else {
          invalidateArtifactCache(options.artifactPath);
          const runtime = await runtimePromise;
          await runtime.refresh();
        }
      },
      watchRun: async ({ modifiedFiles, removedFiles }) => {
        await runtimePromise; // Ensure runtime is ready
        if (builderController && builderWatch) {
          if (!builderController.initialized) {
            await runInitialBuild();
          }
          builderWatch.trackChanges(modifiedFiles, removedFiles);
          const changeSet = await builderWatch.flush();
          if (changeSet) {
            await runIncrementalBuild(changeSet);
          }
        } else {
          const changed = collectChangedFiles(options.contextDir, [modifiedFiles, removedFiles]);
          await handleArtifactFileChange(changed);
        }
      },
      onInvalid: () => {
        builderWatch?.reset();
      },
      onWatchClose: () => {
        builderController?.reset();
        builderWatch?.reset();
        void (async () => {
          const runtime = await runtimePromise;
          runtime.dispose();
        })();
      },
    });

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.fileDependencies.add(options.artifactPath);

      const failure = diagnostics.getFailure();
      if (failure) {
        compilation.errors.push(
          failure.code
            ? new Error(`[${PLUGIN_NAME}] ${failure.code}: ${failure.message}`)
            : new Error(`[${PLUGIN_NAME}] ${failure.message}`),
        );
      }

      if (options.diagnostics === "json") {
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
