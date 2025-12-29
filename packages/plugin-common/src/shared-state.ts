import type { BuilderArtifact } from "@soda-gql/builder";
import type { PluginSession } from "./plugin-session";

/**
 * Transformer type for code transformation.
 * - 'babel': Use Babel plugin (default, wider compatibility)
 * - 'swc': Use SWC transformer (faster, requires @soda-gql/swc-transformer)
 */
export type TransformerType = "babel" | "swc";

/**
 * Minimal interface for SWC transformer.
 * Matches the Transformer interface from @soda-gql/swc-transformer.
 */
export interface SwcTransformerInterface {
  transform(input: { sourceCode: string; sourcePath: string; inputSourceMap?: string }): {
    transformed: boolean;
    sourceCode: string;
    sourceMap?: string;
  };
}

/**
 * Shared state between bundler plugins and loaders.
 * Enables efficient artifact sharing across build pipeline stages.
 */
export type SharedState = {
  pluginSession: PluginSession | null;
  currentArtifact: BuilderArtifact | null;
  moduleAdjacency: Map<string, Set<string>>;
  generation: number;
  swcTransformer: SwcTransformerInterface | null;
  transformerType: TransformerType | null;
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
      swcTransformer: null,
      transformerType: null,
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

/**
 * Set shared SWC transformer.
 */
export const setSharedSwcTransformer = (key: string, transformer: SwcTransformerInterface | null): void => {
  getSharedState(key).swcTransformer = transformer;
};

/**
 * Get shared SWC transformer.
 */
export const getSharedSwcTransformer = (key: string): SwcTransformerInterface | null => {
  return getSharedState(key).swcTransformer;
};

/**
 * Set shared transformer type.
 */
export const setSharedTransformerType = (key: string, transformerType: TransformerType | null): void => {
  getSharedState(key).transformerType = transformerType;
};

/**
 * Get shared transformer type.
 */
export const getSharedTransformerType = (key: string): TransformerType | null => {
  return getSharedState(key).transformerType;
};
