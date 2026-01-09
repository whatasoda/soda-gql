/**
 * Prebuild API for programmatic artifact generation.
 * @module
 */

import type { Result } from "neverthrow";
import { loadConfig } from "@soda-gql/config";
import { setContextTransformer, clearContextTransformer, type ContextTransformer } from "@soda-gql/core/_internal";
import { createBuilderSession, type BuilderArtifact, type BuilderError } from "@soda-gql/builder";

export type { ContextTransformer };

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
export const prebuild = (options: PrebuildOptions): Result<PrebuildResult, BuilderError> => {
	const { configPath, contextTransformer } = options;

	// Load config from file path
	const configResult = loadConfig(configPath);
	if (configResult.isErr()) {
		// Convert ConfigError to BuilderError format
		return configResult as unknown as Result<PrebuildResult, BuilderError>;
	}
	const config = configResult.value;

	if (contextTransformer) {
		setContextTransformer(contextTransformer);
	}

	try {
		const session = createBuilderSession({ config });
		const result = session.build();
		return result.map((artifact) => ({ artifact }));
	} finally {
		clearContextTransformer();
	}
};

/**
 * Build artifact asynchronously from a config file.
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
export const prebuildAsync = async (options: PrebuildOptions): Promise<Result<PrebuildResult, BuilderError>> => {
	const { configPath, contextTransformer } = options;

	// Load config from file path (sync - no async version available)
	const configResult = loadConfig(configPath);
	if (configResult.isErr()) {
		// Convert ConfigError to BuilderError format
		return configResult as unknown as Result<PrebuildResult, BuilderError>;
	}
	const config = configResult.value;

	if (contextTransformer) {
		setContextTransformer(contextTransformer);
	}

	try {
		const session = createBuilderSession({ config });
		const result = await session.buildAsync();
		return result.map((artifact) => ({ artifact }));
	} finally {
		clearContextTransformer();
	}
};
