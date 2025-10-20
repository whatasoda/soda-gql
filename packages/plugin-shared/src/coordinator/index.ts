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
  createCoordinator,
  type PluginCoordinator,
  type PluginCoordinatorOptions,
} from "./plugin-coordinator";
export {
  type CoordinatorConsumer,
  clearCoordinators,
  createAndRegisterCoordinator,
  createCoordinatorKey,
  disposeCoordinator,
  getCoordinator,
  getOrCreateCoordinator,
  registerConsumer,
  release,
  retain,
} from "./registry";
export { computeDiff, createSnapshot } from "./snapshot";
export type {
  CoordinatorDiff,
  CoordinatorEvent,
  CoordinatorKey,
  CoordinatorListener,
  CoordinatorSnapshot,
} from "./types";
