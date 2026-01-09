/**
 * Prebuild API for programmatic artifact generation.
 * @module
 */

import type { Result } from "neverthrow";
import { loadConfig, type ConfigError } from "@soda-gql/config";
import { setContextTransformer, clearContextTransformer, type ContextTransformer } from "@soda-gql/core/_internal";
import { createBuilderSession, type BuilderArtifact, type BuilderError } from "@soda-gql/builder";

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
	const { configPath, contextTransformer } = options;

	// Load config from file path
	const configResult = loadConfig(configPath);
	if (configResult.isErr()) {
		return configResult;
	}
	const config = configResult.value;

	const session = createBuilderSession({ config });

	try {
		if (contextTransformer) {
			setContextTransformer(contextTransformer);
		}
		const result = session.build();
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
	const { configPath, contextTransformer } = options;

	// Load config from file path (sync - no async version available)
	const configResult = loadConfig(configPath);
	if (configResult.isErr()) {
		return configResult;
	}
	const config = configResult.value;

	const session = createBuilderSession({ config });

	try {
		if (contextTransformer) {
			setContextTransformer(contextTransformer);
		}
		const result = await session.buildAsync();
		return result.map((artifact) => ({ artifact }));
	} finally {
		clearContextTransformer();
		session.dispose();
	}
};
