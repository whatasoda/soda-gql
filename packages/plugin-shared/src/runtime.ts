import { err, ok, type Result } from "neverthrow";

import type { CoordinatorConsumer, CoordinatorKey } from "./coordinator";
import { createAndRegisterCoordinator, registerConsumer } from "./coordinator";
import type { NormalizedOptions } from "./options";
import { normalizePluginOptions } from "./options";
import type { PluginError, PluginState } from "./state";
import type { PluginOptions } from "./types";

/**
 * Plugin runtime instance that manages plugin state lifecycle with coordinator.
 */
export interface PluginRuntime {
  /**
   * Get the current plugin state (throws if initialization failed)
   */
  getState(): PluginState;

  /**
   * Force reload via coordinator
   */
  refresh(): Result<PluginState, PluginError>;

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
  coordinatorKey: CoordinatorKey;
  consumer: CoordinatorConsumer;
  state: PluginState | null;
  initError: PluginError | null;
};

/**
 * Create a plugin runtime from normalized options
 */
export const createPluginRuntimeFromNormalized = (normalized: NormalizedOptions): PluginRuntime => {
  // Create and register coordinator
  const { key } = createAndRegisterCoordinator(normalized);

  const consumer = registerConsumer(key);

  const cache: RuntimeCache = {
    options: normalized,
    coordinatorKey: key,
    consumer,
    state: null,
    initError: null,
  };

  // Initialize state
  const initResult = loadState(cache);
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

    refresh: () => {
      const result = loadState(cache);
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
      cache.consumer.release();
      cache.state = null;
      cache.initError = null;
    },
  };
};

/**
 * Create a plugin runtime from raw options
 */
export const createPluginRuntime = (opts: Partial<PluginOptions> = {}): PluginRuntime => {
  const optionsResult = normalizePluginOptions(opts);

  if (optionsResult.isErr()) {
    // Create a runtime that always throws the normalization error
    const error = mapOptionsError(optionsResult.error);
    return {
      getState: () => {
        throw error;
      },
      refresh: () => err(error),
      getOptions: () => {
        throw error;
      },
      dispose: () => {},
    };
  }

  return createPluginRuntimeFromNormalized(optionsResult.value);
};

const loadState = (cache: RuntimeCache): Result<PluginState, PluginError> => {
  try {
    const snapshot = cache.consumer.ensureLatest();

    const state: PluginState = {
      options: cache.options,
      allArtifacts: snapshot.elements,
      coordinatorKey: cache.coordinatorKey,
      snapshot,
    };

    return ok(state);
  } catch (error) {
    return err({
      type: "PluginError",
      stage: "builder",
      code: "SODA_GQL_BUILDER_UNEXPECTED",
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }
};

const mapOptionsError = (error: import("./options.js").OptionsError): PluginError => {
  switch (error.code) {
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
  }
};
