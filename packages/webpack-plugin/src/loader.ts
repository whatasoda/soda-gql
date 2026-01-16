import { relative, resolve } from "node:path";
import { createBabelTransformer } from "@soda-gql/babel";
import {
  createPluginSession,
  getSharedArtifact,
  getSharedPluginSession,
  getSharedState,
  getSharedSwcTransformer,
  getStateKey,
  type PluginSession,
} from "@soda-gql/builder/plugin-support";
import { normalizePath } from "@soda-gql/common";
import type { LoaderDefinitionFunction } from "webpack";
import type { WebpackLoaderOptions } from "./types";

/**
 * Ensure plugin session is initialized.
 * First tries to use shared session from plugin, falls back to creating own.
 */
const ensurePluginSession = (options: WebpackLoaderOptions): PluginSession | null => {
  const stateKey = getStateKey(options.configPath);

  // Try to use shared session from plugin first
  const sharedSession = getSharedPluginSession(stateKey);
  if (sharedSession) {
    return sharedSession;
  }

  // Fall back to creating own session (for standalone loader usage)
  return createPluginSession(
    {
      configPath: options.configPath,
      enabled: options.enabled,
    },
    "@soda-gql/webpack-plugin/loader",
  );
};

/**
 * Webpack loader that transforms soda-gql code using the babel-plugin.
 */
const sodaGqlLoader: LoaderDefinitionFunction<WebpackLoaderOptions> = function (source, inputSourceMap) {
  const callback = this.async();
  const options = this.getOptions();
  const filename = this.resourcePath;
  const stateKey = getStateKey(options.configPath);

  (async () => {
    try {
      const session = ensurePluginSession(options);
      if (!session) {
        // Plugin disabled or config load failed, pass through unchanged
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
        return;
      }

      // Try to use shared artifact from plugin first (more efficient in watch mode)
      let artifact = getSharedArtifact(stateKey);

      // Fall back to fetching artifact if not shared
      if (!artifact) {
        artifact = await session.getArtifactAsync();
      }

      if (!artifact) {
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
        return;
      }

      const baseDir = session.config.baseDir;

      // Helper to convert absolute path to relative for matching against artifact sourcePaths
      const toRelativePath = (absolutePath: string): string => {
        return normalizePath(relative(baseDir, absolutePath));
      };

      // Helper to convert relative path to absolute for webpack's addDependency
      const toAbsolutePath = (relativePath: string): string => {
        return normalizePath(resolve(baseDir, relativePath));
      };

      // Check if this file contains any soda-gql elements
      // Convert absolute path to relative for matching against artifact sourcePaths
      const relativePath = toRelativePath(filename);
      const hasElements = Object.values(artifact.elements).some(
        (element) => normalizePath(element.metadata.sourcePath) === relativePath,
      );

      if (!hasElements) {
        // Not a soda-gql file, pass through unchanged
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
        return;
      }

      // Add dependencies based on module adjacency for precise HMR
      const sharedState = getSharedState(stateKey);
      const relativeFilename = toRelativePath(filename);

      // Use module adjacency for efficient dependency tracking
      // moduleAdjacency maps: importedFile -> Set<importingFiles> (now using relative paths)
      if (sharedState.moduleAdjacency.size > 0) {
        // Add files that import this file (reverse dependencies)
        const importers = sharedState.moduleAdjacency.get(relativeFilename);
        if (importers) {
          for (const importer of importers) {
            // Convert relative path to absolute for webpack
            this.addDependency(toAbsolutePath(importer));
          }
        }

        // Add files that this file imports (forward dependencies)
        for (const [importedFile, importingFiles] of sharedState.moduleAdjacency) {
          if (importingFiles.has(relativeFilename)) {
            // Convert relative path to absolute for webpack
            this.addDependency(toAbsolutePath(importedFile));
          }
        }
      } else {
        // Fallback: Add all soda-gql source files as dependencies (conservative approach)
        for (const element of Object.values(artifact.elements)) {
          const elementPath = element.metadata.sourcePath;
          if (elementPath && elementPath !== relativePath) {
            // Convert relative path to absolute for webpack
            this.addDependency(toAbsolutePath(elementPath));
          }
        }
      }

      // Use SWC transformer if configured and available
      if (options.transformer === "swc") {
        const swcTransformer = getSharedSwcTransformer(stateKey);
        if (swcTransformer) {
          const result = swcTransformer.transform({
            sourceCode: source,
            sourcePath: filename,
            inputSourceMap: inputSourceMap ? JSON.stringify(inputSourceMap) : undefined,
          });

          if (result.transformed) {
            const sourceMap = result.sourceMap ? JSON.parse(result.sourceMap) : undefined;
            callback(null, result.sourceCode, sourceMap);
            return;
          }
          // Not transformed (no soda-gql code in file), pass through
          callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
          return;
        }
        // SWC transformer not available, fall through to Babel
        console.warn(
          "[@soda-gql/webpack-plugin] SWC transformer not available, falling back to Babel. " +
            "Ensure the plugin has transformer: 'swc' option set.",
        );
      }

      // Transform using babel-transformer directly (default)
      const babelTransformer = createBabelTransformer({
        artifact,
        config: session.config,
        sourceMap: true,
      });

      const result = babelTransformer.transform({
        sourceCode: source,
        sourcePath: filename,
        inputSourceMap: inputSourceMap ? JSON.stringify(inputSourceMap) : undefined,
      });

      if (result.transformed) {
        const sourceMap = result.sourceMap ? JSON.parse(result.sourceMap) : undefined;
        callback(null, result.sourceCode, sourceMap);
      } else {
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
      }
    } catch (error) {
      callback(error as Error);
    }
  })();
};

export default sodaGqlLoader;

// Mark as non-raw (we handle string source code)
export const raw = false;
