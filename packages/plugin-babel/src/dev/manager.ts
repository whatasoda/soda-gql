import type { BuilderServiceConfig } from "@soda-gql/builder";
import type { CoordinatorKey, CoordinatorSnapshot, NormalizedOptions } from "@soda-gql/plugin-shared";
import { createBuilderServiceController, DevBuilderSession, type DevBuilderSessionLike } from "@soda-gql/plugin-shared/dev";
import { createStateStore, type StateStore } from "./state-store";

export interface DevManager {
  ensureInitialized(params: {
    config: BuilderServiceConfig;
    options: NormalizedOptions;
    coordinatorKey: CoordinatorKey;
    initialSnapshot: CoordinatorSnapshot;
  }): Promise<void>;
  getStateStore(): StateStore;
  dispose(): void;
}

export interface DevManagerDependencies {
  createController?: typeof createBuilderServiceController;
  createSession?: typeof DevBuilderSession;
  createStateStore?: typeof createStateStore;
}

export const createDevManager = (deps: DevManagerDependencies = {}): DevManager => {
  const {
    createController = createBuilderServiceController,
    createSession = DevBuilderSession,
    createStateStore: createStore = createStateStore,
  } = deps;

  let stateStore: StateStore | null = null;
  let session: DevBuilderSessionLike | null = null;
  let unsubscribe: (() => void) | null = null;
  let initialized = false;
  let cachedOptions: NormalizedOptions | null = null;
  let cachedCoordinatorKey: CoordinatorKey | null = null;
  let cachedSnapshot: CoordinatorSnapshot | null = null;

  return {
    async ensureInitialized(params) {
      if (initialized) {
        return;
      }

      const { config, options, coordinatorKey, initialSnapshot } = params;
      cachedOptions = options;
      cachedCoordinatorKey = coordinatorKey;
      cachedSnapshot = initialSnapshot;

      try {
        // Create controller
        const controller = createController(config);

        // Create session with initial artifact from coordinator snapshot
        session = new createSession({
          controller,
          initialArtifact: initialSnapshot.artifact,
        });

        // Create and initialize state store with coordinator snapshot
        stateStore = createStore();
        stateStore.initialize(options, initialSnapshot.artifact, coordinatorKey, initialSnapshot);

        // Subscribe to session events
        unsubscribe = session.subscribe((event) => {
          if (!stateStore) return;

          if (event.type === "artifact") {
            if (!cachedOptions || !cachedCoordinatorKey || !cachedSnapshot) {
              throw new Error("[INTERNAL] cached values not set");
            }

            // Create updated snapshot for state store
            const updatedSnapshot: CoordinatorSnapshot = {
              artifact: event.artifact,
              elements: event.artifact.elements,
              generation: cachedSnapshot.generation + 1,
              createdAt: Date.now(),
              options: cachedOptions,
            };
            cachedSnapshot = updatedSnapshot;

            try {
              const snapshot = stateStore.getSnapshot();
              if (snapshot.status === "error" || !snapshot.state) {
                // Error recovery or initial initialization
                stateStore.initialize(cachedOptions, event.artifact, cachedCoordinatorKey, updatedSnapshot);
              } else {
                // Normal update
                stateStore.updateArtifact(event.artifact, updatedSnapshot);
              }
            } catch (err) {
              // If getSnapshot throws (not initialized), initialize now
              if (err instanceof Error && err.message.includes("not initialized")) {
                stateStore.initialize(cachedOptions, event.artifact, cachedCoordinatorKey, updatedSnapshot);
              } else {
                throw err;
              }
            }
          } else if (event.type === "error") {
            const error =
              event.error.type === "builder-error"
                ? new Error(`Builder error: ${event.error.error.message}`)
                : new Error("Unexpected builder error", { cause: event.error.error });
            stateStore.setError(error);
          }
        });

        // Ensure initial build
        await session.ensureInitialBuild();

        initialized = true;
      } catch (error) {
        // Clean up on initialization failure
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        stateStore = null;
        session = null;
        cachedOptions = null;
        cachedCoordinatorKey = null;
        cachedSnapshot = null;
        throw error;
      }
    },

    getStateStore() {
      if (!stateStore) {
        throw new Error("DevManager not initialized - call ensureInitialized() first");
      }
      return stateStore;
    },

    dispose() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (session && typeof session.reset === "function") {
        session.reset();
      }
      stateStore = null;
      session = null;
      cachedOptions = null;
      cachedCoordinatorKey = null;
      cachedSnapshot = null;
      initialized = false;
    },
  };
};

/**
 * Context key for identifying unique DevManager instances.
 * Each unique project should have its own manager to avoid state conflicts.
 */
export type DevManagerContext = {
  readonly configPath: string;
  readonly projectRoot: string;
  readonly schemaHash?: string;
};

const createContextKey = (context: DevManagerContext): string => {
  return JSON.stringify({
    config: context.configPath,
    root: context.projectRoot,
    schema: context.schemaHash,
  });
};

// Registry for multiple managers (one per project/context)
const managerRegistry = new Map<string, DevManager>();

export const getDevManager = (context: DevManagerContext): DevManager => {
  const key = createContextKey(context);

  let manager = managerRegistry.get(key);
  if (!manager) {
    manager = createDevManager();
    managerRegistry.set(key, manager);
  }

  return manager;
};

/**
 * Clear DevManager for a specific context or all contexts.
 * Useful for testing and cleanup.
 */
export const clearDevManager = (context?: DevManagerContext): void => {
  if (context) {
    const key = createContextKey(context);
    const manager = managerRegistry.get(key);
    if (manager) {
      manager.dispose();
      managerRegistry.delete(key);
    }
  } else {
    // Clear all managers
    for (const manager of managerRegistry.values()) {
      manager.dispose();
    }
    managerRegistry.clear();
  }
};
