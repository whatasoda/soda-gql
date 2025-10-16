import type { BuilderServiceConfig } from "@soda-gql/builder";
import type { BuilderChangeSet } from "@soda-gql/builder/change-set";
import type { NormalizedOptions } from "../options.js";
import {
  type BuilderServiceController,
  createBuilderServiceController,
} from "../dev/builder-service-controller.js";
import { computeDiff, createSnapshot } from "./snapshot.js";
import { SubscriptionManager } from "./subscriptions.js";
import type { CoordinatorDiff, CoordinatorSnapshot } from "./types.js";

export interface PluginCoordinatorOptions {
  readonly builderConfig: BuilderServiceConfig;
  readonly normalizedOptions: NormalizedOptions;
}

/**
 * Central coordinator for managing builder artifacts and subscriptions.
 * Wraps BuilderServiceController and provides snapshot-based access to artifacts.
 */
export class PluginCoordinator {
  private readonly controller: BuilderServiceController;
  private readonly subscriptions = new SubscriptionManager();
  private readonly normalizedOptions: NormalizedOptions;
  private currentSnapshot: CoordinatorSnapshot | null = null;
  private disposed = false;

  constructor(options: PluginCoordinatorOptions) {
    this.controller = createBuilderServiceController(options.builderConfig);
    this.normalizedOptions = options.normalizedOptions;
  }

  /**
   * Ensure the latest artifact is built and return a snapshot.
   * If already initialized, returns the current snapshot without rebuilding.
   * For incremental updates, use update() instead.
   */
  async ensureLatest(): Promise<CoordinatorSnapshot> {
    this.assertNotDisposed();

    if (this.currentSnapshot) {
      return this.currentSnapshot;
    }

    const result = await this.controller.build();

    if (result.isErr()) {
      const error =
        result.error.type === "builder-error" ? result.error.error : new Error(String(result.error.error));

      this.subscriptions.emit({ type: "error", error });
      throw error;
    }

    const snapshot = createSnapshot(result.value, this.normalizedOptions, this.controller.getGeneration());

    const diff = computeDiff(this.currentSnapshot, snapshot);
    this.currentSnapshot = snapshot;

    this.subscriptions.emit({
      type: "artifact",
      snapshot,
      diff,
    });

    return snapshot;
  }

  /**
   * Apply incremental changes and return updated snapshot.
   */
  async update(changeSet: BuilderChangeSet): Promise<CoordinatorSnapshot> {
    this.assertNotDisposed();

    const result = await this.controller.update(changeSet);

    if (result.isErr()) {
      const error =
        result.error.type === "builder-error" ? result.error.error : new Error(String(result.error.error));

      this.subscriptions.emit({ type: "error", error });
      throw error;
    }

    const prevSnapshot = this.currentSnapshot;
    const snapshot = createSnapshot(result.value, this.normalizedOptions, this.controller.getGeneration());

    const diff = computeDiff(prevSnapshot, snapshot);
    this.currentSnapshot = snapshot;

    this.subscriptions.emit({
      type: "artifact",
      snapshot,
      diff,
    });

    return snapshot;
  }

  /**
   * Get current snapshot without triggering a build.
   * Returns null if no build has completed yet.
   */
  snapshot(): CoordinatorSnapshot | null {
    this.assertNotDisposed();
    return this.currentSnapshot;
  }

  /**
   * Compute diff between a previous generation and current snapshot.
   */
  diffSince(prevGeneration: number): CoordinatorDiff | null {
    if (!this.currentSnapshot || this.currentSnapshot.generation === prevGeneration) {
      return null;
    }

    // If we don't have the previous snapshot, return a full diff
    return {
      added: Object.keys(this.currentSnapshot.allArtifacts) as Array<string>,
      updated: [],
      removed: [],
    };
  }

  /**
   * Subscribe to coordinator events (artifact updates, errors, disposal).
   * @returns Unsubscribe function
   */
  subscribe(listener: (event: import("./types.js").CoordinatorEvent) => void): () => void {
    this.assertNotDisposed();
    return this.subscriptions.subscribe(listener);
  }

  /**
   * Reset the builder state and clear the current snapshot.
   */
  reset(): void {
    this.assertNotDisposed();
    this.controller.reset();
    this.currentSnapshot = null;
  }

  /**
   * Dispose the coordinator and release all resources.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.controller.reset();
    this.subscriptions.dispose();
    this.currentSnapshot = null;
  }

  /**
   * Check if coordinator has been initialized with at least one successful build.
   */
  get initialized(): boolean {
    return this.controller.initialized;
  }

  /**
   * Get current generation number.
   */
  get generation(): number {
    return this.controller.getGeneration();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Coordinator has been disposed");
    }
  }
}

/**
 * Factory function to create a PluginCoordinator instance.
 */
export const createCoordinator = (options: PluginCoordinatorOptions): PluginCoordinator => {
  return new PluginCoordinator(options);
};
