import type { Result } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";
import { generateArtifact } from "./runner";
import type { BuilderError, BuilderInput } from "./types";

/**
 * Configuration for BuilderService.
 * Mirrors BuilderInput shape.
 */
export type BuilderServiceConfig = BuilderInput;

/**
 * Builder service interface providing artifact generation.
 */
export interface BuilderService {
  /**
   * Generate artifacts from configured entry points.
   * Returns Result containing BuilderArtifact on success or BuilderError on failure.
   */
  build(): Promise<Result<BuilderArtifact, BuilderError>>;
}

/**
 * Create a builder service instance.
 *
 * The service encapsulates artifact generation configuration and provides
 * a simple build() method for on-demand artifact creation.
 *
 * Note: Empty entry arrays will produce ENTRY_NOT_FOUND errors at build time.
 *
 * @param config - Builder configuration including entry patterns, analyzer, mode, and optional debugDir
 * @returns BuilderService instance
 */
export const createBuilderService = (config: BuilderServiceConfig): BuilderService => {
  // Normalize config to prevent accidental mutation
  const normalizedConfig: BuilderInput = {
    mode: config.mode,
    entry: [...config.entry],
    analyzer: config.analyzer,
    ...(config.debugDir !== undefined && { debugDir: config.debugDir }),
  };

  return {
    build: async () => generateArtifact(normalizedConfig),
  };
};
