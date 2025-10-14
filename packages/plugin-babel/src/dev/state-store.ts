import type { BuilderArtifact } from "@soda-gql/builder";
import type { NormalizedOptions, PluginState } from "@soda-gql/plugin-shared";

export type StateSnapshot =
  | { readonly status: "ready"; readonly state: PluginState }
  | { readonly status: "error"; readonly error: Error; readonly lastValidState: PluginState | null };

export type StateStore = {
  initialize(options: NormalizedOptions, artifact: BuilderArtifact): void;
  getSnapshot(): StateSnapshot;
  getState(): PluginState;
  getError(): Error | null;
  hasError(): boolean;
  getGeneration(): number;
  updateArtifact(artifact: BuilderArtifact): void;
  setError(error: Error): void;
  clearError(): void;
  subscribe(listener: (snapshot: StateSnapshot) => void): () => void;
};

export const createStateStore = (): StateStore => {
  let currentState: PluginState | null = null;
  let lastValidState: PluginState | null = null;
  let currentError: Error | null = null;
  let generation = 0;
  const listeners = new Set<(snapshot: StateSnapshot) => void>();

  const getSnapshot = (): StateSnapshot => {
    if (currentError) {
      return {
        status: "error",
        error: currentError,
        lastValidState,
      };
    }

    if (!currentState) {
      throw new Error("StateStore not initialized");
    }

    return {
      status: "ready",
      state: currentState,
    };
  };

  const notify = () => {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  return {
    initialize(options, artifact) {
      if (currentState && !currentError) {
        throw new Error("StateStore already initialized");
      }

      currentState = {
        options,
        allArtifacts: artifact.elements,
      };
      lastValidState = currentState;
      currentError = null;
      generation = 0;

      notify();
    },

    getSnapshot,

    getState() {
      if (currentError) {
        throw currentError;
      }
      if (!currentState) {
        throw new Error("StateStore not initialized");
      }
      return currentState;
    },

    getError() {
      return currentError;
    },

    hasError() {
      return currentError !== null;
    },

    getGeneration() {
      return generation;
    },

    updateArtifact(artifact) {
      if (!currentState) {
        throw new Error("StateStore not initialized - call initialize() first");
      }

      generation++;
      currentState = {
        options: currentState.options,
        allArtifacts: artifact.elements,
      };
      lastValidState = currentState;
      currentError = null;

      notify();
    },

    setError(error) {
      currentError = error;
      notify();
    },

    clearError() {
      currentError = null;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      // Immediately notify with current state
      try {
        listener(getSnapshot());
      } catch {
        // Ignore errors during initial notification
      }
      return () => listeners.delete(listener);
    },
  };
};
