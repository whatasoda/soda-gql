import { err, ok, type Result } from "neverthrow";
import type { PluginOptions } from "../types.js";
import { createPluginRuntimeFromNormalized, type PluginRuntime } from "../runtime.js";
import { normalizePluginOptions, type OptionsError } from "../options.js";
import type { PluginError, PluginState } from "../state.js";

/**
 * Arguments for preparing a transform operation
 */
export type PrepareTransformArgs = {
  readonly filename: string;
  readonly artifactPath: string;
  readonly mode: "runtime" | "zero-runtime";
  readonly importIdentifier?: string;
  readonly configPath?: string;
};

/**
 * Result of transform preparation containing state and cleanup
 */
export type PreparedTransform = {
  readonly state: PluginState;
  readonly runtime: PluginRuntime;
  readonly dispose: () => void;
};

// Module-level runtime cache shared across all hosts
const runtimeCache = new Map<string, Promise<PluginRuntime>>();

/**
 * Prepare transform by normalizing options and loading plugin state.
 * Returns the plugin state and runtime for use by adapter-specific transform logic.
 *
 * This is the host-agnostic core that can be reused by webpack, TypeScript, SWC, etc.
 */
export async function prepareTransform(args: PrepareTransformArgs): Promise<Result<PreparedTransform, PluginError>> {
  // Normalize plugin options
  const normalizedResult = await normalizePluginOptions({
    mode: args.mode,
    importIdentifier: args.importIdentifier,
    configPath: args.configPath,
    artifact: {
      useBuilder: false,
      path: args.artifactPath,
    },
  } satisfies Partial<PluginOptions>);

  if (normalizedResult.isErr()) {
    return err(mapOptionsError(normalizedResult.error));
  }

  const normalizedOptions = normalizedResult.value;

  // Short-circuit for runtime mode - no transformation needed
  // Return early - caller should check mode before calling prepareTransform
  if (normalizedOptions.mode === "runtime") {
    throw new Error("prepareTransform should not be called in runtime mode");
  }

  // Create runtime key for caching
  const runtimeKey = JSON.stringify({
    artifactPath: args.artifactPath,
    mode: normalizedOptions.mode,
    importIdentifier: normalizedOptions.importIdentifier,
  });

  // Get or create cached runtime
  const getRuntime = async (): Promise<PluginRuntime> => {
    let entry = runtimeCache.get(runtimeKey);
    if (!entry) {
      entry = createPluginRuntimeFromNormalized(normalizedOptions);
      runtimeCache.set(runtimeKey, entry);
    }
    return entry;
  };

  try {
    const runtime = await getRuntime();
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
}

/**
 * Clear the module-level runtime cache.
 * Useful for testing or when artifact files change.
 */
export function clearRuntimeCache(): void {
  runtimeCache.clear();
}
