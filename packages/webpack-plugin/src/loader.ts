import type { LoaderContext, LoaderDefinitionFunction } from "webpack";
import { transformSync, type TransformOptions } from "@babel/core";
import { createPluginSession, type PluginSession } from "@soda-gql/plugin-common";
import { createSodaGqlPlugin } from "@soda-gql/babel-plugin";
import { normalizePath } from "@soda-gql/common";
import type { WebpackLoaderOptions } from "./types";

// Module-level cache for plugin session
let pluginSession: PluginSession | null = null;
let sessionInitialized = false;

/**
 * Ensure plugin session is initialized (singleton pattern).
 */
const ensurePluginSession = (options: WebpackLoaderOptions): PluginSession | null => {
  if (sessionInitialized) {
    return pluginSession;
  }

  sessionInitialized = true;
  pluginSession = createPluginSession(
    {
      configPath: options.configPath,
      enabled: options.enabled,
    },
    "@soda-gql/webpack-plugin/loader",
  );

  return pluginSession;
};

/**
 * Webpack loader that transforms soda-gql code using the babel-plugin.
 */
const sodaGqlLoader: LoaderDefinitionFunction<WebpackLoaderOptions> = function (source, inputSourceMap) {
  const callback = this.async();
  const options = this.getOptions();
  const filename = this.resourcePath;

  (async () => {
    try {
      const session = ensurePluginSession(options);
      if (!session) {
        // Plugin disabled or config load failed, pass through unchanged
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
        return;
      }

      // Get current artifact to verify we should transform this file
      const artifact = await session.getArtifactAsync();
      if (!artifact) {
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
        return;
      }

      // Check if this file contains any soda-gql elements
      const normalizedPath = normalizePath(filename);
      const hasElements = Object.values(artifact.elements).some(
        (element) => normalizePath(element.metadata.sourcePath) === normalizedPath,
      );

      if (!hasElements) {
        // Not a soda-gql file, pass through unchanged
        callback(null, source, inputSourceMap as Parameters<typeof callback>[2]);
        return;
      }

      // Transform using Babel plugin
      const babelOptions: TransformOptions = {
        filename,
        babelrc: false,
        configFile: false,
        plugins: [[createSodaGqlPlugin, { configPath: options.configPath }]],
        sourceMaps: true,
        inputSourceMap: inputSourceMap as TransformOptions["inputSourceMap"],
      };

      const result = transformSync(source, babelOptions);

      if (result?.code) {
        callback(null, result.code, result.map as Parameters<typeof callback>[2]);
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
