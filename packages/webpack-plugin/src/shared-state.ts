import type { BuilderArtifact } from "@soda-gql/builder";
import type { PluginSession } from "@soda-gql/plugin-common";

/**
 * Shared state between webpack plugin and loader.
 * Uses a WeakMap keyed by compiler to support multiple compiler instances.
 */
type SharedState = {
  pluginSession: PluginSession | null;
  currentArtifact: BuilderArtifact | null;
  moduleAdjacency: Map<string, Set<string>>;
  generation: number;
};

// Global state for sharing between plugin and loader
const sharedStates = new Map<string, SharedState>();

/**
 * Get shared state for a given project (identified by config path or cwd).
 */
export const getSharedState = (key: string): SharedState => {
  let state = sharedStates.get(key);
  if (!state) {
    state = {
      pluginSession: null,
      currentArtifact: null,
      moduleAdjacency: new Map(),
      generation: 0,
    };
    sharedStates.set(key, state);
  }
  return state;
};

/**
 * Update shared artifact.
 */
export const setSharedArtifact = (
  key: string,
  artifact: BuilderArtifact | null,
  moduleAdjacency?: Map<string, Set<string>>,
): void => {
  const state = getSharedState(key);
  state.currentArtifact = artifact;
  if (moduleAdjacency) {
    state.moduleAdjacency = moduleAdjacency;
  }
  state.generation++;
};

/**
 * Get shared artifact.
 */
export const getSharedArtifact = (key: string): BuilderArtifact | null => {
  return getSharedState(key).currentArtifact;
};

/**
 * Get shared plugin session.
 */
export const getSharedPluginSession = (key: string): PluginSession | null => {
  return getSharedState(key).pluginSession;
};

/**
 * Set shared plugin session.
 */
export const setSharedPluginSession = (key: string, session: PluginSession | null): void => {
  getSharedState(key).pluginSession = session;
};

/**
 * Get the state key from config path or cwd.
 */
export const getStateKey = (configPath?: string): string => {
  return configPath ?? process.cwd();
};
