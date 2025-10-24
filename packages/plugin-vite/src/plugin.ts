/**
 * Vite plugin for soda-gql.
 *
 * This plugin integrates soda-gql's zero-runtime transformations
 * into Vite's build process using the Rollup plugin API.
 *
 * Supports both development (with HMR) and production builds.
 */

import { transformAsync, parseSync, traverse, type NodePath } from "@babel/core";
import * as t from "@babel/types";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { createPluginSession, type PluginOptions } from "@soda-gql/plugin-common";
import type { Plugin, HmrContext } from "vite";

/**
 * Vite plugin options for soda-gql.
 */
export type VitePluginOptions = PluginOptions;

/**
 * Create a Vite plugin for soda-gql.
 *
 * @example
 * ```typescript
 * // In vite.config.ts:
 * import { defineConfig } from 'vite';
 * import { sodaGqlVitePlugin } from '@soda-gql/plugin-vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     sodaGqlVitePlugin({
 *       configPath: './soda-gql.config.ts'
 *     })
 *   ]
 * });
 * ```
 */
export function sodaGqlVitePlugin(options: VitePluginOptions = {}): Plugin {
  // Create plugin session
  const pluginSession = createPluginSession(options, "@soda-gql/plugin-vite");

  if (!pluginSession) {
    // Return no-op plugin if disabled or config loading failed
    return {
      name: "soda-gql",
    };
  }

  // Create graphql system identify helper
  const graphqlSystemIdentifyHelper = createGraphqlSystemIdentifyHelper(pluginSession.config);

  // Track which files contain gql calls for HMR
  const filesWithGqlCalls = new Set<string>();

  return {
    name: "soda-gql",
    enforce: "pre", // Run before other plugins

    /**
     * Transform hook - processes each module
     */
    async transform(code: string, id: string) {
      // Filter: only process TypeScript/JavaScript files
      // Skip node_modules unless it's a soda-gql package
      if (!id.match(/\.(tsx?|jsx?)$/)) {
        return null;
      }

      if (id.includes("node_modules") && !id.includes("@soda-gql")) {
        return null;
      }

      // Quick check: skip if no potential gql calls
      if (!code.includes("gql.") && !code.includes("gql(")) {
        return null;
      }

      // Parse to verify if there are actual gql calls
      let hasGqlCalls = false;
      try {
        const ast = parseSync(code, {
          filename: id,
          parserOpts: {
            sourceType: "module",
            plugins: ["typescript", "jsx"],
          },
        });

        if (!ast) {
          return null;
        }

        traverse(ast, {
          CallExpression(path: NodePath<t.CallExpression>) {
            const callee = path.node.callee;
            // Check for gql.default() or similar patterns
            if (
              t.isMemberExpression(callee) &&
              t.isIdentifier(callee.object) &&
              graphqlSystemIdentifyHelper.isGqlIdentifier(callee.object.name)
            ) {
              hasGqlCalls = true;
              path.stop();
            }
          },
        });
      } catch (error) {
        // Parse error - let Vite handle it
        return null;
      }

      if (!hasGqlCalls) {
        filesWithGqlCalls.delete(id);
        return null;
      }

      // Mark file as containing gql calls for HMR
      filesWithGqlCalls.add(id);

      // Get artifact
      const artifact = pluginSession.getArtifact();
      if (!artifact) {
        console.warn(`[@soda-gql/plugin-vite] Failed to get artifact for ${id}`);
        return null;
      }

      // Transform using Babel plugin
      // We import the Babel plugin transformer dynamically to reuse the transformation logic
      const { createPlugin } = await import("@soda-gql/plugin-babel");

      try {
        const result = await transformAsync(code, {
          filename: id,
          sourceMaps: true,
          configFile: false,
          babelrc: false,
          parserOpts: {
            sourceType: "module",
            plugins: ["typescript", "jsx"],
          },
          plugins: [
            [
              createPlugin,
              {
                pluginSession: {
                  config: pluginSession.config,
                  getArtifact: () => artifact,
                },
              },
            ],
          ],
        });

        if (!result || !result.code) {
          return null;
        }

        return {
          code: result.code,
          map: result.map,
        };
      } catch (error) {
        console.error(`[@soda-gql/plugin-vite] Transform error in ${id}:`, error);
        throw error;
      }
    },

    /**
     * HMR hook - handle hot module updates
     */
    handleHotUpdate(ctx: HmrContext) {
      const { file } = ctx;

      // If a file with gql calls was updated, invalidate its module
      if (filesWithGqlCalls.has(file)) {
        console.log(`[@soda-gql/plugin-vite] HMR: Invalidating ${file}`);

        // Force full reload for files with gql calls
        // This ensures the artifact is rebuilt and transformations are reapplied
        return ctx.modules;
      }

      return undefined;
    },

    /**
     * Build start hook - log initialization
     */
    buildStart() {
      console.log("[@soda-gql/plugin-vite] Plugin initialized");
    },
  };
}

/**
 * Default export for consistency
 */
export default sodaGqlVitePlugin;
