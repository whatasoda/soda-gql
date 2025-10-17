/**
 * Coordinator-based transform state preparation for TypeScript compiler plugins.
 *
 * TypeScript transformer factories must be synchronous, so we use a blocking bridge
 * to access the async coordinator API synchronously. This module manages coordinator
 * consumers with caching and lifecycle management.
 */

import type { BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type { CoordinatorConsumer, CoordinatorKey, CoordinatorListener, PluginError } from "@soda-gql/plugin-shared";
import { err, ok, type Result } from "neverthrow";
import { BlockingSyncNotSupportedError, runPromiseSync } from "./blocking.js";

/**
 * Configuration for transform state preparation.
 */
export type PrepareTransformStateArgs = {
  readonly configPath?: string;
  readonly project?: string;
  readonly importIdentifier?: string;
};

/**
 * Prepared state for transformation.
 */
export type PreparedTransformState = {
  readonly importIdentifier: string;
  readonly allArtifacts: Record<CanonicalId, BuilderArtifactElement>;
  readonly release: () => void;
};

/**
 * Errors that can occur during state preparation.
 */
export type PrepareTransformStateError =
  | { readonly type: "BLOCKING_NOT_SUPPORTED"; readonly message: string }
  | { readonly type: "PLUGIN_ERROR"; readonly error: PluginError };

/**
 * Cache entry with consumer and subscription management.
 */
interface CacheEntry {
  consumer: CoordinatorConsumer;
  unsubscribe: () => void;
  allArtifacts: Record<CanonicalId, BuilderArtifactElement>;
}

// Module-level cache keyed by coordinator key
const stateCache = new Map<CoordinatorKey, CacheEntry>();

/**
 * Prepare transformation state using the coordinator.
 *
 * This function:
 * 1. Normalizes options and creates/retrieves a coordinator consumer
 * 2. Blocks to ensure the latest artifact is built
 * 3. Caches the consumer and subscribes to updates
 * 4. Returns prepared state with artifact lookup and cleanup function
 *
 * @param args - Configuration for preparation
 * @returns Result containing prepared state or error
 */
export function prepareTransformState(
  args: PrepareTransformStateArgs,
): Result<PreparedTransformState, PrepareTransformStateError> {
  try {
    // Import plugin-shared synchronously (modules are already loaded at this point)
    const { preparePluginState, registerConsumer } = require("@soda-gql/plugin-shared");

    // Prepare plugin state synchronously using blocking bridge
    const stateResult = runPromiseSync<Result<any, PluginError>>(() =>
      preparePluginState({
        configPath: args.configPath,
        project: args.project,
        importIdentifier: args.importIdentifier,
      }),
    );

    if (stateResult.isErr()) {
      return err({
        type: "PLUGIN_ERROR",
        error: stateResult.error,
      });
    }

    const state = stateResult.value;
    const coordinatorKey = state.coordinatorKey;

    // Check cache
    let cached = stateCache.get(coordinatorKey);

    if (!cached) {
      // Register consumer and create cache entry
      const consumer = registerConsumer(coordinatorKey);

      // Subscribe to updates to keep cache fresh
      const unsubscribe = consumer.subscribe((event: Parameters<CoordinatorListener>[0]) => {
        if (event.type === "artifact") {
          const entry = stateCache.get(coordinatorKey);
          if (entry) {
            entry.allArtifacts = event.snapshot.elements;
          }
        } else if (event.type === "error") {
          console.error("[@soda-gql/plugin-nestjs] Coordinator error:", event.error);
        }
      });

      cached = {
        consumer,
        unsubscribe,
        allArtifacts: state.allArtifacts,
      };

      stateCache.set(coordinatorKey, cached);
    }

    // Ensure latest snapshot synchronously
    const snapshot = runPromiseSync(() => cached!.consumer.ensureLatest());
    cached.allArtifacts = snapshot.elements;

    return ok({
      importIdentifier: state.options.importIdentifier,
      allArtifacts: cached.allArtifacts,
      release: () => {
        // Release is typically called when the transformer is done
        // For now, we keep the cache alive for reuse
        // Actual cleanup happens in clearPrepareSyncCache
      },
    });
  } catch (error) {
    if (error instanceof BlockingSyncNotSupportedError) {
      return err({
        type: "BLOCKING_NOT_SUPPORTED",
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * Clear the preparation cache and release all consumers.
 * This should be called when the compiler process ends or in tests.
 */
export function clearPrepareSyncCache(): void {
  for (const entry of stateCache.values()) {
    entry.unsubscribe();
    entry.consumer.release();
  }
  stateCache.clear();
}
