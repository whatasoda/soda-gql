import type { BuilderArtifact } from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

import type { ArtifactProvider } from "./artifact";
import { createArtifactProvider } from "./artifact";
import type { NormalizedOptions } from "./options";
import { normalizePluginOptions } from "./options";
import type { PluginError, PluginState } from "./state";
import type { PluginOptions } from "./types";

/**
 * Plugin runtime instance that manages plugin state lifecycle
 */
export interface PluginRuntime {
  /**
   * Get the current plugin state (throws if initialization failed)
   */
  getState(): PluginState;

  /**
   * Force reload via current artifact provider
   */
  refresh(): Promise<Result<PluginState, PluginError>>;

  /**
   * Get the normalized options
   */
  getOptions(): NormalizedOptions;

  /**
   * Clear in-memory cache and dispose resources
   */
  dispose(): void;
}

type RuntimeCache = {
  options: NormalizedOptions;
  provider: ArtifactProvider;
  state: PluginState | null;
  initError: PluginError | null;
};

/**
 * Create a plugin runtime from normalized options
 */
export const createPluginRuntimeFromNormalized = async (normalized: NormalizedOptions): Promise<PluginRuntime> => {
  const provider = createArtifactProvider(normalized);

  const cache: RuntimeCache = {
    options: normalized,
    provider,
    state: null,
    initError: null,
  };

  // Initialize state
  const initResult = await loadState(cache);
  if (initResult.isErr()) {
    cache.initError = initResult.error;
  } else {
    cache.state = initResult.value;
  }

  return {
    getState: () => {
      if (cache.initError) {
        throw cache.initError;
      }
      if (!cache.state) {
        throw new Error("Plugin state not initialized");
      }
      return cache.state;
    },

    refresh: async () => {
      const result = await loadState(cache);
      if (result.isOk()) {
        cache.state = result.value;
        cache.initError = null;
      } else {
        cache.initError = result.error;
      }
      return result;
    },

    getOptions: () => cache.options,

    dispose: () => {
      cache.state = null;
      cache.initError = null;
    },
  };
};

/**
 * Create a plugin runtime from raw options
 */
export const createPluginRuntime = async (opts: Partial<PluginOptions> = {}): Promise<PluginRuntime> => {
  const optionsResult = await normalizePluginOptions(opts);

  if (optionsResult.isErr()) {
    // Create a runtime that always throws the normalization error
    const error = mapOptionsError(optionsResult.error);
    return {
      getState: () => {
        throw error;
      },
      refresh: async () => err(error),
      getOptions: () => {
        throw error;
      },
      dispose: () => {},
    };
  }

  return createPluginRuntimeFromNormalized(optionsResult.value);
};

const loadState = async (cache: RuntimeCache): Promise<Result<PluginState, PluginError>> => {
  const artifactResult = await cache.provider.load();

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  const state = createPluginStateWithProvider(cache.options, artifactResult.value, cache.provider);

  return ok(state);
};

const createPluginStateWithProvider = (
  options: NormalizedOptions,
  artifact: BuilderArtifact,
  provider: ArtifactProvider,
): PluginState => ({
  options,
  allArtifacts: artifact.elements,
  artifactProvider: provider,
});

const mapOptionsError = (error: import("./options").OptionsError): PluginError => {
  switch (error.code) {
    case "MISSING_ARTIFACT_PATH":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_MISSING_ARTIFACT_PATH",
        message: error.message,
        cause: error,
      };
    case "INVALID_BUILDER_CONFIG":
    case "MISSING_BUILDER_CONFIG":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: error.message,
        cause: error,
      };
    case "CONFIG_LOAD_FAILED":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: `Config load failed: ${error.message}`,
        cause: error,
      };
    case "PROJECT_NOT_FOUND":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: `Project not found: ${error.project}`,
        cause: error,
      };
    case "INVALID_ARTIFACT_OVERRIDE":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_MISSING_ARTIFACT_PATH",
        message: error.message,
        cause: error,
      };
  }
};
