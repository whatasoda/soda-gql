import { err, ok, type Result } from "neverthrow";
import { normalizePluginOptions, type OptionsError } from "../options";
import { createPluginRuntimeFromNormalized, type PluginRuntime } from "../runtime";
import type { PluginError, PluginState } from "../state";
import type { PluginOptions } from "../types";

/**
 * Arguments for preparing a transform operation (simplified for coordinator-based architecture)
 */
export type PrepareTransformArgs = {
  readonly filename: string;
  readonly importIdentifier?: string;
  readonly configPath?: string;
  readonly project?: string;
};

/**
 * Result of transform preparation containing state and cleanup
 */
export type PreparedTransform = {
  readonly state: PluginState;
  readonly runtime: PluginRuntime;
  readonly dispose: () => void;
};

// Module-level runtime cache keyed by coordinator key
const runtimeCache = new Map<string, PluginRuntime>();

/**
 * Prepare transform by normalizing options and loading plugin state via coordinator.
 * Returns the plugin state and runtime for use by adapter-specific transform logic.
 *
 * This is the host-agnostic core that can be reused by webpack, TypeScript, SWC, etc.
 */
export async function prepareTransform(args: PrepareTransformArgs): Promise<Result<PreparedTransform, PluginError>> {
  // Normalize plugin options
  const normalizedResult = await normalizePluginOptions({
    importIdentifier: args.importIdentifier,
    configPath: args.configPath,
    project: args.project,
  } satisfies Partial<PluginOptions>);

  if (normalizedResult.isErr()) {
    return err(mapOptionsError(normalizedResult.error));
  }

  const normalizedOptions = normalizedResult.value;

  // Create runtime key for caching based on config
  const runtimeKey = JSON.stringify({
    project: normalizedOptions.project,
    importIdentifier: normalizedOptions.importIdentifier,
  });

  // Get or create cached runtime
  const getRuntime = (): PluginRuntime => {
    let entry = runtimeCache.get(runtimeKey);
    if (!entry) {
      entry = createPluginRuntimeFromNormalized(normalizedOptions);
      runtimeCache.set(runtimeKey, entry);
    }
    return entry;
  };

  try {
    const runtime = getRuntime();
    const state = runtime.getState();

    return ok({
      state,
      runtime,
      dispose: () => {
        // Runtime remains cached - only clear on explicit request
      },
    });
  } catch (error) {
    // If runtime.getState() throws, it's already a PluginError
    if (typeof error === "object" && error !== null && "type" in error && error.type === "PluginError") {
      return err(error as PluginError);
    }

    // Unexpected error - wrap it
    throw error;
  }
}

/**
 * Map OptionsError to PluginError using existing patterns from state.ts
 */
const mapOptionsError = (error: OptionsError): PluginError => {
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

/**
 * Clear the module-level runtime cache.
 * Useful for testing or when you want to force a rebuild.
 */
export function clearRuntimeCache(): void {
  runtimeCache.clear();
}
