import type { BuilderArtifact } from "@soda-gql/builder";
import type { NormalizedOptions, PluginState } from "@soda-gql/plugin-shared";

export type StateStore = {
  initialize(options: NormalizedOptions, artifact: BuilderArtifact): void;
  getSnapshot(): PluginState;
  getGeneration(): number;
  updateArtifact(artifact: BuilderArtifact): void;
  setError(error: Error): void;
  subscribe(listener: () => void): () => void;
};

export const createStateStore = (): StateStore => {
  let currentState: PluginState | null = null;
  let generation = 0;
  let lastError: Error | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    initialize(options, artifact) {
      if (currentState) {
        throw new Error("StateStore already initialized");
      }

      currentState = {
        options,
        allArtifacts: artifact.elements,
      };
      generation = 0;

      notify();
    },

    getSnapshot() {
      if (!currentState) {
        throw new Error("StateStore not initialized");
      }
      return currentState;
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
      lastError = null;

      notify();
    },

    setError(error) {
      lastError = error;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
