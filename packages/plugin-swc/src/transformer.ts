/**
 * SWC transformer for Nest CLI integration.
 *
 * This transformer integrates soda-gql's zero-runtime transformations
 * into the Nest CLI build process when using `builder: "swc"`.
 */

import { createPluginSession, type PluginOptions } from "@soda-gql/plugin-common";
import type { Module } from "@swc/types";
import { createSwcAdapter, type SwcEnv } from "./internal/ast/swc-adapter";

/**
 * SWC plugin options.
 */
export type SwcPluginOptions = PluginOptions;

/**
 * Configuration for the soda-gql SWC transformer.
 */
export type TransformerConfig = SwcPluginOptions;

const noopTransformer = (m: Module) => m;

/**
 * Create an SWC plugin for soda-gql.
 *
 * This plugin signature matches the SWC plugin API expected by Nest CLI.
 *
 * @example
 * ```json
 * // In nest-cli.json:
 * {
 *   "compilerOptions": {
 *     "builder": "swc",
 *     "swcPlugins": [
 *       [
 *         "@soda-gql/plugin-swc",
 *         {
 *           "configPath": "./soda-gql.config.ts"
 *         }
 *       ]
 *     ]
 *   }
 * }
 * ```
 */
export function createSodaGqlSwcPlugin(config: TransformerConfig = {}) {
  // Create plugin session
  const pluginSession = createPluginSession(config, "@soda-gql/plugin-swc");

  if (!pluginSession) {
    return noopTransformer;
  }

  console.log("[@soda-gql/plugin-swc] Plugin initialized");

  // Get runtime module from config aliases or use default (like babel-plugin)
  const runtimeModule = pluginSession.config.graphqlSystemAliases[0] ?? "@/graphql-system";

  return (m: Module, options: { filename: string; swc: typeof import("@swc/core") }): Module => {
    const filename = options.filename;

    // Rebuild artifact on every compilation (like tsc-plugin)
    const artifact = pluginSession.getArtifact();
    if (!artifact) {
      return m;
    }

    // Create SWC adapter environment
    const env: SwcEnv = {
      module: m,
      swc: options.swc,
      filename,
    };

    // Create SWC adapter
    const adapter = createSwcAdapter(env);

    // Transform the program
    const transformContext = {
      filename,
      artifactLookup: (canonicalId: import("@soda-gql/builder").CanonicalId) => artifact.elements[canonicalId],
      runtimeModule,
    };

    const transformResult = adapter.transformProgram(transformContext);

    if (!transformResult.transformed) {
      return m;
    }

    // Insert runtime side effects
    adapter.insertRuntimeSideEffects(transformContext, transformResult.runtimeArtifacts ?? []);

    // Return the transformed module
    return adapter.getModule();
  };
}

/**
 * Default export for Nest CLI plugin resolution.
 *
 * For SWC plugins, Nest CLI expects a factory function that returns the transformer.
 * This is different from TypeScript plugins which use the before() hook pattern.
 */
export default function sodaGqlSwcPlugin(config?: Partial<TransformerConfig>) {
  return createSodaGqlSwcPlugin(config);
}

/**
 * Named export for consistency with TypeScript plugin API.
 * Some tools may expect a named export instead of default.
 */
export { createSodaGqlSwcPlugin as plugin };
