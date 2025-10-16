/**
 * Plugin coordinator for managing in-memory builder artifacts.
 *
 * The coordinator provides a centralized way to manage builder artifacts without file I/O.
 * It maintains snapshots of artifacts, handles subscriptions for incremental updates,
 * and provides both sync and async access patterns.
 *
 * @module coordinator
 */

export {
  type PluginCoordinator,
  type PluginCoordinatorOptions,
  createCoordinator,
} from "./plugin-coordinator.js";

export {
  type CoordinatorSnapshot,
  type CoordinatorDiff,
  type CoordinatorEvent,
  type CoordinatorListener,
  type CoordinatorKey,
} from "./types.js";

export {
  createCoordinatorKey,
  getOrCreateCoordinator,
  getCoordinator,
  retain,
  release,
  disposeCoordinator,
  clearCoordinators,
  registerConsumer,
  createAndRegisterCoordinator,
  type CoordinatorConsumer,
} from "./registry.js";

export { createSnapshot, computeDiff } from "./snapshot.js";
