import crypto from "node:crypto";
import { type TransformOptions, transformSync } from "@babel/core";
import { createPluginWithArtifact } from "@soda-gql/babel-plugin";
import { normalizePath } from "@soda-gql/common";
import {
  createPluginSession,
  getSharedArtifact,
  getSharedPluginSession,
  getSharedState,
  getStateKey,
  type PluginSession,
  setSharedArtifact,
  setSharedPluginSession,
} from "@soda-gql/plugin-common";
import type { MetroTransformer, MetroTransformParams, MetroTransformResult } from "./types";

/**
 * Upstream transformer candidates in order of preference.
 * - Expo projects: @expo/metro-config/babel-transformer
 * - React Native 0.73+: @react-native/metro-babel-transformer
 * - Legacy React Native: metro-react-native-babel-transformer
 */
const UPSTREAM_TRANSFORMER_CANDIDATES = [
  "@expo/metro-config/babel-transformer",
  "@react-native/metro-babel-transformer",
  "metro-react-native-babel-transformer",
] as const;

/**
 * Cached upstream transformer module.
 */
let upstreamTransformer: MetroTransformer | null = null;

/**
 * Try to resolve a module from multiple locations.
 * Falls back through various resolution strategies.
 */
const tryResolve = (moduleName: string): string | null => {
  // Try direct require first (same module resolution as this package)
  try {
    return require.resolve(moduleName);
  } catch {
    // Continue to fallbacks
  }

  // Try resolving from project root (for hoisted dependencies)
  try {
    return require.resolve(moduleName, { paths: [process.cwd()] });
  } catch {
    // Continue to fallbacks
  }

  return null;
};

/**
 * Detect and load the upstream Metro Babel transformer.
 * Tries multiple candidates in order of preference.
 */
const getUpstreamTransformer = (): MetroTransformer => {
  if (upstreamTransformer) {
    return upstreamTransformer;
  }

  for (const candidate of UPSTREAM_TRANSFORMER_CANDIDATES) {
    const resolved = tryResolve(candidate);
    if (resolved) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      upstreamTransformer = require(resolved) as MetroTransformer;
      return upstreamTransformer;
    }
  }

  throw new Error(
    `No compatible Metro Babel transformer found. Tried: ${UPSTREAM_TRANSFORMER_CANDIDATES.join(", ")}. ` +
      `Please install one of these packages.`,
  );
};

/**
 * Cached plugin session.
 */
let pluginSession: PluginSession | null = null;
let sessionInitialized = false;

/**
 * Ensure plugin session is initialized.
 * First tries to use shared session, falls back to creating own.
 */
const ensurePluginSession = (): PluginSession | null => {
  const stateKey = getStateKey();

  // Try to use shared session first
  const sharedSession = getSharedPluginSession(stateKey);
  if (sharedSession) {
    return sharedSession;
  }

  // Fall back to creating own session (lazy initialization)
  if (!sessionInitialized) {
    sessionInitialized = true;
    pluginSession = createPluginSession({}, "@soda-gql/metro-plugin");
    if (pluginSession) {
      setSharedPluginSession(stateKey, pluginSession);
    }
  }

  return pluginSession;
};

/**
 * Transform source code with soda-gql transformations.
 * Wraps the upstream Metro Babel transformer.
 */
export async function transform(params: MetroTransformParams): Promise<MetroTransformResult> {
  const { src, filename, options } = params;
  const stateKey = getStateKey();
  const upstream = getUpstreamTransformer();

  const session = ensurePluginSession();
  if (!session) {
    // Plugin disabled or config load failed, pass through to upstream
    return upstream.transform(params);
  }

  // Get or build artifact
  let artifact = getSharedArtifact(stateKey);
  if (!artifact) {
    artifact = await session.getArtifactAsync();
    if (artifact) {
      setSharedArtifact(stateKey, artifact);
    }
  }

  if (!artifact) {
    // No artifact available, pass through to upstream
    return upstream.transform(params);
  }

  // Check if this file contains any soda-gql elements
  const normalizedPath = normalizePath(filename);
  const hasElements = Object.values(artifact.elements).some(
    (element) => normalizePath(element.metadata.sourcePath) === normalizedPath,
  );

  if (!hasElements) {
    // Not a soda-gql file, pass through to upstream
    return upstream.transform(params);
  }

  // Transform with soda-gql Babel plugin first
  const sodaGqlPlugin = createPluginWithArtifact({
    artifact,
    config: session.config,
  });

  const babelOptions: TransformOptions = {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [sodaGqlPlugin],
    sourceMaps: true,
  };

  const babelResult = transformSync(src, babelOptions);

  if (!babelResult?.code) {
    // Babel transformation failed, pass through original source
    return upstream.transform(params);
  }

  // Pass transformed code to upstream transformer
  return upstream.transform({
    src: babelResult.code,
    filename,
    options,
  });
}

/**
 * Get cache key for the transformer.
 * Includes artifact generation to ensure cache invalidation when models change.
 */
export function getCacheKey(): string {
  const stateKey = getStateKey();
  const state = getSharedState(stateKey);
  const artifact = state.currentArtifact;
  const upstream = getUpstreamTransformer();

  const hash = crypto.createHash("md5");
  hash.update("@soda-gql/metro-plugin:v1");

  // Include upstream cache key if available
  if (upstream.getCacheKey) {
    hash.update(upstream.getCacheKey());
  }

  // Include artifact generation for cache invalidation
  hash.update(String(state.generation));

  // Include element count as additional cache key component
  if (artifact) {
    hash.update(String(Object.keys(artifact.elements).length));
  }

  return hash.digest("hex");
}

// Export as module interface for Metro
const transformer: MetroTransformer = {
  transform,
  getCacheKey,
};

export default transformer;
