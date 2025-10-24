/**
 * Webpack loader for soda-gql.
 *
 * This loader integrates soda-gql's zero-runtime transformations
 * into Webpack's build process using Babel internally.
 *
 * Compatible with both Webpack 5 and Turbopack.
 */

import { transformAsync } from "@babel/core";
import { createPluginSession, type PluginOptions } from "@soda-gql/plugin-common";
import type { LoaderDefinitionFunction } from "webpack";

/**
 * Webpack loader options for soda-gql.
 */
export type WebpackLoaderOptions = PluginOptions;

/**
 * Webpack loader for soda-gql transformations.
 *
 * @example
 * ```javascript
 * // webpack.config.js
 * module.exports = {
 *   module: {
 *     rules: [
 *       {
 *         test: /\.(ts|tsx|js|jsx)$/,
 *         exclude: /node_modules/,
 *         use: [
 *           {
 *             loader: '@soda-gql/plugin-webpack',
 *             options: {
 *               configPath: './soda-gql.config.ts'
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * };
 * ```
 */
const sodaGqlLoader: LoaderDefinitionFunction<WebpackLoaderOptions> = function (source, sourceMap) {
  const callback = this.async();
  if (!callback) {
    throw new Error("[@soda-gql/plugin-webpack] Async loader callback is required");
  }

  // Mark this loader as cacheable
  this.cacheable(true);

  const sourceCode = typeof source === "string" ? source : source.toString("utf8");
  const filePath = this.resourcePath;

  // Skip .d.ts files
  if (/\.d\.tsx?$/.test(filePath)) {
    callback(null, sourceCode, sourceMap);
    return;
  }

  // Get loader options
  const options = this.getOptions();

  // Quick check: skip if no potential gql calls
  if (!sourceCode.includes("gql.") && !sourceCode.includes("gql(")) {
    callback(null, sourceCode, sourceMap);
    return;
  }

  // Create plugin session
  const pluginSession = createPluginSession(options, "@soda-gql/plugin-webpack");

  if (!pluginSession) {
    // If plugin is disabled or config loading failed, pass through
    callback(null, sourceCode, sourceMap);
    return;
  }

  // Get artifact
  const artifact = pluginSession.getArtifact();
  if (!artifact) {
    this.emitWarning(new Error(`[@soda-gql/plugin-webpack] Failed to get artifact for ${filePath}`));
    callback(null, sourceCode, sourceMap);
    return;
  }

  // Transform using Babel plugin
  // We import the Babel plugin dynamically to reuse the transformation logic
  import("@soda-gql/plugin-babel")
    .then(({ createPlugin }) => {
      // Create plugin factory function
      const plugin = () =>
        createPlugin({
          pluginSession: {
            config: pluginSession.config,
            getArtifact: () => artifact,
          },
        });

      // Determine parser plugins based on file extension
      const parserPlugins: Array<string | [string, Record<string, unknown>]> = [];

      if (/\.tsx?$/.test(filePath)) {
        parserPlugins.push("typescript");
      }

      if (/\.[jt]sx$/.test(filePath)) {
        parserPlugins.push("jsx");
      }

      return transformAsync(sourceCode, {
        filename: filePath,
        sourceMaps: this.sourceMap,
        inputSourceMap: sourceMap || undefined,
        configFile: false,
        babelrc: false,
        parserOpts: {
          sourceType: "module",
          plugins: parserPlugins,
        },
        plugins: [[plugin, {}]],
      });
    })
    .then((result) => {
      if (!result || !result.code) {
        callback(null, sourceCode, sourceMap);
        return;
      }

      callback(null, result.code, result.map || undefined);
    })
    .catch((error) => {
      callback(new Error(`[@soda-gql/plugin-webpack] Transform error in ${filePath}: ${error.message}`));
    });
};

export default sodaGqlLoader;
