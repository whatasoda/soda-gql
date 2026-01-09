/**
 * Prebuild API for programmatic artifact generation.
 * @module
 */

import { type BuilderArtifact, type BuilderError, createBuilderSession } from "@soda-gql/builder";
import { type ConfigError, loadConfig } from "@soda-gql/config";
import { type ContextTransformer, clearContextTransformer, setContextTransformer } from "@soda-gql/core/_internal";
import { err, type Result } from "neverthrow";

export type { ContextTransformer };

/**
 * Error type for prebuild operations.
 * Can be either a config loading error or a builder error.
 */
export type PrebuildError = ConfigError | BuilderError;

/**
 * Options for prebuild functions.
 */
export interface PrebuildOptions {
  /** Path to soda-gql config file */
  configPath: string;
  /** Optional context transformer to modify composer context */
  contextTransformer?: ContextTransformer;
  /** Unique identifier for this evaluator instance (default: "default") */
  evaluatorId?: string;
  /** Override entrypoints from config.include */
  entrypointsOverride?: readonly string[] | ReadonlySet<string>;
  /** Force rebuild even if no changes detected */
  force?: boolean;
}

/**
 * Result of prebuild operations.
 */
export interface PrebuildResult {
  artifact: BuilderArtifact;
}

/**
 * Build artifact synchronously from a config file.
 *
 * @remarks
 * **Concurrent Execution Warning**: This function uses global state for context transformation.
 * Do not run multiple `prebuild` or `prebuildAsync` calls concurrently with different
 * `contextTransformer` options. Sequential execution is safe.
 *
 * **Session Lifecycle**: This function automatically handles session lifecycle:
 * - Creates a BuilderSession with the resolved config
 * - Calls `session.dispose()` in a finally block to:
 *   - Save incremental build cache to disk
 *   - Unregister from process exit handler
 * - Clears context transformer state after build
 *
 * @param options - Prebuild options including config path and optional transformer
 * @returns Result containing the built artifact or an error
 *
 * @example
 * ```typescript
 * const result = prebuild({ configPath: './soda-gql.config.ts' });
 * if (result.isOk()) {
 *   console.log(result.value.artifact.elements);
 * }
 * ```
 */
export const prebuild = (options: PrebuildOptions): Result<PrebuildResult, PrebuildError> => {
  const { configPath, contextTransformer, evaluatorId, entrypointsOverride, force } = options;

  // Load config from file path
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    return err(configResult.error);
  }
  const config = configResult.value;

  const session = createBuilderSession({ config, evaluatorId, entrypointsOverride });

  try {
    if (contextTransformer) {
      setContextTransformer(contextTransformer);
    }
    const result = session.build({ force });
    return result.map((artifact) => ({ artifact }));
  } finally {
    clearContextTransformer();
    session.dispose();
  }
};

/**
 * Build artifact asynchronously from a config file.
 *
 * @remarks
 * **Concurrent Execution Warning**: This function uses global state for context transformation.
 * Do not run multiple `prebuild` or `prebuildAsync` calls concurrently with different
 * `contextTransformer` options. Sequential execution is safe.
 *
 * **Session Lifecycle**: This function automatically handles session lifecycle:
 * - Creates a BuilderSession with the resolved config
 * - Calls `session.dispose()` in a finally block to:
 *   - Save incremental build cache to disk
 *   - Unregister from process exit handler
 * - Clears context transformer state after build
 *
 * @param options - Prebuild options including config path and optional transformer
 * @returns Promise resolving to Result containing the built artifact or an error
 *
 * @example
 * ```typescript
 * const result = await prebuildAsync({ configPath: './soda-gql.config.ts' });
 * if (result.isOk()) {
 *   console.log(result.value.artifact.elements);
 * }
 * ```
 */
export const prebuildAsync = async (options: PrebuildOptions): Promise<Result<PrebuildResult, PrebuildError>> => {
  const { configPath, contextTransformer, evaluatorId, entrypointsOverride, force } = options;

  // Load config from file path (sync - no async version available)
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    return err(configResult.error);
  }
  const config = configResult.value;

  const session = createBuilderSession({ config, evaluatorId, entrypointsOverride });

  try {
    if (contextTransformer) {
      setContextTransformer(contextTransformer);
    }
    const result = await session.buildAsync({ force });
    return result.map((artifact) => ({ artifact }));
  } finally {
    clearContextTransformer();
    session.dispose();
  }
};
