import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { Result } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";
import type { BuilderChangeSet } from "./session";
import { createBuilderSession } from "./session";
import type { BuilderError } from "./types";

/**
 * Configuration for BuilderService.
 * Mirrors BuilderInput shape.
 */
export type BuilderServiceConfig = {
  readonly config: ResolvedSodaGqlConfig;
  readonly entrypoints: readonly string[] | ReadonlySet<string>;
};

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

  /**
   * Get the current generation number of the artifact.
   * Increments on each successful build or update.
   * Returns 0 if no artifact has been built yet.
   */
  getGeneration?(): number;

  /**
   * Get the most recent artifact without triggering a new build.
   * Returns null if no artifact has been built yet.
   */
  getCurrentArtifact?(): BuilderArtifact | null;
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
export const createBuilderService = ({ config, entrypoints }: BuilderServiceConfig): BuilderService => {
  const session = createBuilderSession({ config, entrypoints });
  let generation = 0;
  let currentArtifact: BuilderArtifact | null = null;

  const wrapBuild = async (buildFn: () => Promise<Result<BuilderArtifact, BuilderError>>) => {
    const result = await buildFn();
    if (result.isOk()) {
      generation++;
      currentArtifact = result.value;
    }
    return result;
  };

  return {
    build: async () => wrapBuild(() => session.build({ changeSet: null })),
    update: async (changeSet: BuilderChangeSet) => wrapBuild(() => session.build({ changeSet })),
    getGeneration: () => generation,
    getCurrentArtifact: () => currentArtifact,
  };
};
