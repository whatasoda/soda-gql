import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { Result } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";
import { createBuilderSession } from "./session";
import type { BuilderError } from "./types";

/**
 * Configuration for BuilderService.
 * Mirrors BuilderInput shape.
 */
export type BuilderServiceConfig = {
  readonly config: ResolvedSodaGqlConfig;
  readonly entrypointsOverride?: readonly string[] | ReadonlySet<string>;
};

/**
 * Builder service interface providing artifact generation.
 */
export interface BuilderService {
  /**
   * Generate artifacts from configured entry points (synchronous).
   *
   * The service automatically detects file changes using an internal file tracker.
   * On first call, performs full build. Subsequent calls perform incremental builds
   * based on detected file changes (added/updated/removed).
   *
   * Throws if any element requires async operations (e.g., async metadata factory).
   *
   * @param options - Optional build options
   * @param options.force - If true, bypass change detection and force full rebuild
   * @returns Result containing BuilderArtifact on success or BuilderError on failure.
   */
  build(options?: { force?: boolean }): Result<BuilderArtifact, BuilderError>;

  /**
   * Generate artifacts from configured entry points (asynchronous).
   *
   * The service automatically detects file changes using an internal file tracker.
   * On first call, performs full build. Subsequent calls perform incremental builds
   * based on detected file changes (added/updated/removed).
   *
   * Supports async metadata factories and parallel element evaluation.
   *
   * @param options - Optional build options
   * @param options.force - If true, bypass change detection and force full rebuild
   * @returns Promise of Result containing BuilderArtifact on success or BuilderError on failure.
   */
  buildAsync(options?: { force?: boolean }): Promise<Result<BuilderArtifact, BuilderError>>;

  /**
   * Get the current generation number of the artifact.
   * Increments on each successful build.
   * Returns 0 if no artifact has been built yet.
   */
  getGeneration(): number;

  /**
   * Get the most recent artifact without triggering a new build.
   * Returns null if no artifact has been built yet.
   */
  getCurrentArtifact(): BuilderArtifact | null;

  /**
   * Dispose the service and save cache to disk.
   * Should be called when the service is no longer needed.
   */
  dispose(): void;
}

/**
 * Create a builder service instance with session support.
 *
 * The service maintains a long-lived session for incremental builds.
 * File changes are automatically detected using an internal file tracker.
 * First build() call initializes the session, subsequent calls perform
 * incremental builds based on detected file changes.
 *
 * Note: Empty entry arrays will produce ENTRY_NOT_FOUND errors at build time.
 *
 * @param config - Builder configuration including entry patterns, analyzer, mode, and optional debugDir
 * @returns BuilderService instance
 */
export const createBuilderService = ({ config, entrypointsOverride }: BuilderServiceConfig): BuilderService => {
  const session = createBuilderSession({ config, entrypointsOverride });

  return {
    build: (options) => session.build(options),
    buildAsync: (options) => session.buildAsync(options),
    getGeneration: () => session.getGeneration(),
    getCurrentArtifact: () => session.getCurrentArtifact(),
    dispose: () => session.dispose(),
  };
};
