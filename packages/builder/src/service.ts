import { cachedFn } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { Result } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";
import { createBuilderSession } from "./internal/session/builder-session";
import type { BuilderChangeSet } from "./internal/session/change-set";
import type { BuilderError } from "./types";

/**
 * Configuration for BuilderService.
 * Mirrors BuilderInput shape.
 */
export type BuilderServiceConfig = ResolvedSodaGqlConfig;

/**
 * Builder service interface providing artifact generation.
 */
export interface BuilderService {
  /**
   * Generate artifacts from configured entry points.
   * Returns Result containing BuilderArtifact on success or BuilderError on failure.
   */
  build(): Promise<Result<BuilderArtifact, BuilderError>>;

  /**
   * Perform incremental update based on file changes.
   * Optional method for incremental builds. Falls back to full rebuild if not supported.
   */
  update(changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>>;
}

/**
 * Create a builder service instance with session support.
 *
 * The service maintains a long-lived session for incremental builds.
 * First build() call initializes the session, subsequent calls reuse cached state.
 * Use update() for incremental processing when files change.
 *
 * Note: Empty entry arrays will produce ENTRY_NOT_FOUND errors at build time.
 *
 * @param config - Builder configuration including entry patterns, analyzer, mode, and optional debugDir
 * @returns BuilderService instance
 */
export const createBuilderService = (config: BuilderServiceConfig): BuilderService => {
  // Lazy session initialization
  const ensureSession = cachedFn(() => createBuilderSession({ config }));

  return {
    build: async () => {
      const session = ensureSession();

      // Subsequent builds reuse session (for now, just call buildInitial again)
      // NOTE: Change detection via update() is handled by CLI watch mode
      // Direct service.build() calls do full rebuild for correctness
      return session.buildInitial();
    },

    update: async (changeSet: BuilderChangeSet) => {
      const session = ensureSession();

      return session.update(changeSet);
    },
  };
};
