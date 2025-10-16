import { createHash } from "node:crypto";
import type { BuilderServiceConfig } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { NormalizedOptions } from "../options.js";
import { type PluginCoordinator, createCoordinator } from "./plugin-coordinator.js";
import type { CoordinatorKey, CoordinatorSnapshot } from "./types.js";

/**
 * Registry entry with reference counting.
 */
interface RegistryEntry {
  coordinator: PluginCoordinator;
  refCount: number;
  key: CoordinatorKey;
}

/**
 * Global registry of coordinator instances.
 */
const registry = new Map<CoordinatorKey, RegistryEntry>();

/**
 * Create a unique key for a coordinator based on its configuration.
 */
export const createCoordinatorKey = (config: {
  configPath: string;
  projectRoot: string;
  project?: string;
}): CoordinatorKey => {
  const hash = createHash("sha256");
  hash.update(config.configPath);
  hash.update(config.projectRoot);
  if (config.project) {
    hash.update(config.project);
  }
  // Include a version marker to invalidate cache when coordinator changes
  hash.update("v1");
  return hash.digest("hex");
};

/**
 * Get or create a coordinator instance.
 */
export const getOrCreateCoordinator = async (
  key: CoordinatorKey,
  factory: () => Promise<PluginCoordinator> | PluginCoordinator,
): Promise<PluginCoordinator> => {
  const existing = registry.get(key);
  if (existing) {
    return existing.coordinator;
  }

  const coordinator = await factory();
  registry.set(key, {
    coordinator,
    refCount: 0,
    key,
  });

  return coordinator;
};

/**
 * Get an existing coordinator by key.
 */
export const getCoordinator = (key: CoordinatorKey): PluginCoordinator | null => {
  const entry = registry.get(key);
  return entry?.coordinator ?? null;
};

/**
 * Increment reference count for a coordinator.
 */
export const retain = (key: CoordinatorKey): void => {
  const entry = registry.get(key);
  if (entry) {
    entry.refCount++;
  }
};

/**
 * Decrement reference count and dispose if no longer used.
 */
export const release = (key: CoordinatorKey): void => {
  const entry = registry.get(key);
  if (!entry) return;

  entry.refCount--;

  if (entry.refCount <= 0) {
    entry.coordinator.dispose();
    registry.delete(key);
  }
};

/**
 * Dispose a specific coordinator.
 */
export const disposeCoordinator = (key: CoordinatorKey): void => {
  const entry = registry.get(key);
  if (!entry) return;

  entry.coordinator.dispose();
  registry.delete(key);
};

/**
 * Clear all coordinators from registry.
 */
export const clearCoordinators = (): void => {
  for (const entry of registry.values()) {
    entry.coordinator.dispose();
  }
  registry.clear();
};

/**
 * Consumer interface for simplified coordinator access with automatic lifecycle management.
 */
export interface CoordinatorConsumer {
  /** Get current snapshot without building */
  snapshot(): CoordinatorSnapshot | null;
  /** Ensure latest artifact and return snapshot */
  ensureLatest(): Promise<CoordinatorSnapshot>;
  /** Subscribe to events */
  subscribe(listener: (event: import("./types.js").CoordinatorEvent) => void): () => void;
  /** Release this consumer's reference */
  release(): void;
  /** Get the coordinator key */
  readonly key: CoordinatorKey;
}

/**
 * Register a consumer and get a simplified interface.
 * Automatically manages reference counting.
 */
export const registerConsumer = (key: CoordinatorKey): CoordinatorConsumer => {
  const coordinator = getCoordinator(key);
  if (!coordinator) {
    throw new Error(
      `Coordinator not found for key: ${key}. ` +
        `Ensure the coordinator is created before registering consumers. ` +
        `This usually means you need to call withSodaGql() or initialize the plugin before using transforms.`,
    );
  }

  retain(key);

  return {
    snapshot: () => coordinator.snapshot(),
    ensureLatest: () => coordinator.ensureLatest(),
    subscribe: (listener) => coordinator.subscribe(listener),
    release: () => release(key),
    key,
  };
};

/**
 * Create coordinator from config and register it.
 */
export const createAndRegisterCoordinator = async (
  config: ResolvedSodaGqlConfig,
  builderConfig: BuilderServiceConfig,
  normalizedOptions: NormalizedOptions,
): Promise<{ key: CoordinatorKey; coordinator: PluginCoordinator }> => {
  const key = createCoordinatorKey({
    configPath: config.configFilePath,
    projectRoot: config.project.projectRoot,
    project: config.projectName,
  });

  const coordinator = await getOrCreateCoordinator(key, () =>
    createCoordinator({
      builderConfig,
      normalizedOptions,
    }),
  );

  return { key, coordinator };
};
