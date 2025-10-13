import type { BuilderArtifact, BuilderServiceConfig } from "@soda-gql/builder";
import type { NormalizedOptions } from "@soda-gql/plugin-shared";
import {
  createBuilderServiceController,
  createBuilderWatch,
  DevBuilderSession,
  type DevBuilderSessionLike,
} from "@soda-gql/plugin-shared/dev";
import { createStateStore, type StateStore } from "./state-store";

export interface DevManager {
  ensureInitialized(params: {
    config: BuilderServiceConfig;
    options: NormalizedOptions;
    watchOptions?: { rootDir: string; schemaHash: string; analyzerVersion: string } | null;
    initialArtifact?: BuilderArtifact;
  }): Promise<void>;
  getStateStore(): StateStore;
  dispose(): void;
}

export interface DevManagerDependencies {
  createController?: typeof createBuilderServiceController;
  createWatch?: typeof createBuilderWatch;
  createSession?: typeof DevBuilderSession;
  createStateStore?: typeof createStateStore;
}

export const createDevManager = (deps: DevManagerDependencies = {}): DevManager => {
  const {
    createController = createBuilderServiceController,
    createWatch = createBuilderWatch,
    createSession = DevBuilderSession,
    createStateStore: createStore = createStateStore,
  } = deps;

  let stateStore: StateStore | null = null;
  let session: DevBuilderSessionLike | null = null;
  let unsubscribe: (() => void) | null = null;
  let initialized = false;
  let cachedOptions: NormalizedOptions | null = null;

  return {
    async ensureInitialized(params) {
      if (initialized) {
        return;
      }

      const { config, options, watchOptions, initialArtifact } = params;
      cachedOptions = options;

      try {
        // Create controller and optional watch
        const controller = createController(config);
        const watch = watchOptions ? createWatch(watchOptions) : undefined;

        // Create session
        session = new createSession({
          controller,
          watch,
          initialArtifact,
        });

        // Create and initialize state store
        stateStore = createStore();
        if (initialArtifact) {
          stateStore.initialize(options, initialArtifact);
        }

        // Subscribe to session events
        unsubscribe = session.subscribe((event) => {
          if (!stateStore) return;

          if (event.type === "artifact") {
            if (!cachedOptions) {
              throw new Error("[INTERNAL] cachedOptions is not set");
            }

            try {
              // Initialize if not yet initialized, otherwise update
              const snapshot = stateStore.getSnapshot();
              if (!snapshot) {
                stateStore.initialize(cachedOptions, event.artifact);
              } else {
                stateStore.updateArtifact(event.artifact);
              }
            } catch (err) {
              // If getSnapshot throws (not initialized), initialize now
              if (err instanceof Error && err.message.includes("not initialized")) {
                stateStore.initialize(cachedOptions, event.artifact);
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
      initialized = false;
    },
  };
};

let globalManager: DevManager | null = null;

export const getDevManager = (): DevManager => {
  if (!globalManager) {
    globalManager = createDevManager();
  }
  return globalManager;
};
