import crypto from "node:crypto";
import remapping, { type SourceMapInput } from "@ampproject/remapping";
import { type TransformOptions, transformSync } from "@babel/core";
import { createPluginWithArtifact } from "@soda-gql/babel-plugin";
import type { BuilderArtifact } from "@soda-gql/builder";
import { normalizePath } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import {
  createPluginSession,
  getSharedArtifact,
  getSharedPluginSession,
  getSharedState,
  getSharedSwcTransformer,
  getSharedTransformerType,
  getStateKey,
  type PluginSession,
  setSharedArtifact,
  setSharedPluginSession,
  setSharedSwcTransformer,
  type SwcTransformerInterface,
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
 * Whether SWC transformer initialization has been attempted.
 */
let swcInitialized = false;

/**
 * Initialize SWC transformer if configured.
 */
const initializeSwcTransformer = async (
  artifact: BuilderArtifact,
  config: ResolvedSodaGqlConfig,
): Promise<SwcTransformerInterface | null> => {
  const stateKey = getStateKey();

  // Check if already initialized
  const existing = getSharedSwcTransformer(stateKey);
  if (existing || swcInitialized) {
    return existing;
  }

  swcInitialized = true;

  // Check if SWC is configured
  const transformerType = getSharedTransformerType(stateKey);
  if (transformerType !== "swc") {
    return null;
  }

  try {
    const { createTransformer } = await import("@soda-gql/swc-transformer");
    const transformer = await createTransformer({
      config,
      artifact,
      sourceMap: true,
    });
    setSharedSwcTransformer(stateKey, transformer);
    return transformer;
  } catch (error) {
    console.warn(
      `[@soda-gql/metro-plugin] Failed to initialize SWC transformer: ${error}. ` +
        "Make sure @soda-gql/swc-transformer is installed. Falling back to Babel.",
    );
    return null;
  }
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

  // Try SWC transformer first if configured
  const swcTransformer = await initializeSwcTransformer(artifact, session.config);
  if (swcTransformer) {
    const swcResult = swcTransformer.transform({
      sourceCode: src,
      sourcePath: filename,
    });

    if (swcResult.transformed) {
      // Pass SWC-transformed code to upstream transformer
      const upstreamResult = await upstream.transform({
        src: swcResult.sourceCode,
        filename,
        options,
      });

      // Chain source maps if both exist
      if (swcResult.sourceMap && upstreamResult.map) {
        const mergedMap = remapping(
          [upstreamResult.map as SourceMapInput, JSON.parse(swcResult.sourceMap) as SourceMapInput],
          () => null,
        );
        return { ...upstreamResult, map: mergedMap };
      }

      // Include our map if upstream doesn't have one
      if (swcResult.sourceMap) {
        return { ...upstreamResult, map: JSON.parse(swcResult.sourceMap) };
      }

      return upstreamResult;
    }
    // SWC didn't transform (no soda-gql code), fall through to upstream
    return upstream.transform(params);
  }

  // Fall back to Babel transformer
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
  const upstreamResult = await upstream.transform({
    src: babelResult.code,
    filename,
    options,
  });

  // Chain source maps if both exist
  if (babelResult.map && upstreamResult.map) {
    // Type assertion needed because Metro's map type is looser than remapping expects
    const mergedMap = remapping([upstreamResult.map as SourceMapInput, babelResult.map as SourceMapInput], () => null);
    return { ...upstreamResult, map: mergedMap };
  }

  // Include our map if upstream doesn't have one
  if (babelResult.map) {
    return { ...upstreamResult, map: babelResult.map };
  }

  return upstreamResult;
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
