/**
 * SWC transformer for Nest CLI integration.
 *
 * This transformer integrates soda-gql's zero-runtime transformations
 * into the Nest CLI build process when using `builder: "swc"`.
 */

import { type SwcAdapter, swcTransformAdapterFactory } from "@soda-gql/plugin-shared";
import { prepareTransformState } from "@soda-gql/plugin-shared/compiler-sync";
import type { Module } from "@swc/types";

/**
 * Configuration for the soda-gql SWC transformer.
 */
export type TransformerConfig = {
  /**
   * Path to the soda-gql config file.
   * If not provided, will search for config in standard locations.
   */
  readonly configPath?: string;

  /**
   * Project name for multi-project configs.
   */
  readonly project?: string;

  /**
   * Import identifier for the GraphQL system.
   * @default "@/graphql-system"
   */
  readonly importIdentifier?: string;

  /**
   * Whether to enable transformation.
   * Set to false to disable the transformer (useful for debugging).
   * @default true
   */
  readonly enabled?: boolean;
};

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
export function createSodaGqlSwcPlugin(rawConfig?: Partial<TransformerConfig>) {
  const config: TransformerConfig = {
    configPath: rawConfig?.configPath,
    project: rawConfig?.project,
    importIdentifier: rawConfig?.importIdentifier ?? "@/graphql-system",
    enabled: rawConfig?.enabled ?? true,
  };

  // Short-circuit if disabled
  if (!config.enabled) {
    return (m: Module) => m;
  }

  // Prepare transform state using coordinator
  const prepareResult = prepareTransformState({
    configPath: config.configPath,
    project: config.project,
    importIdentifier: config.importIdentifier,
    packageLabel: "@soda-gql/plugin-swc",
  });

  // Handle preparation errors
  if (prepareResult.isErr()) {
    const error = prepareResult.error;
    if (error.type === "BLOCKING_NOT_SUPPORTED") {
      console.error(`[@soda-gql/plugin-swc] ${error.message}`);
    } else if (error.type === "PLUGIN_ERROR") {
      const pluginError = error.error;
      console.error(`[@soda-gql/plugin-swc] Transform preparation failed (${pluginError.code}):`, pluginError.message);
    }
    // Return no-op transformer
    return (m: Module) => m;
  }

  const prepared = prepareResult.value;

  return (m: Module, options: { filename: string; swc: typeof import("@swc/core") }): Module => {
    const filename = options.filename;

    // Create SWC adapter
    const adapter = swcTransformAdapterFactory.create({
      module: m,
      swc: options.swc,
      filename,
    }) as SwcAdapter;

    // Transform the program
    const transformContext = {
      filename,
      artifactLookup: (canonicalId: import("@soda-gql/builder").CanonicalId) => prepared.allArtifacts[canonicalId],
    };

    const transformResult = adapter.transformProgram(transformContext);

    if (!transformResult.transformed) {
      return m;
    }

    // Insert runtime side effects
    adapter.insertRuntimeSideEffects(transformContext, transformResult.runtimeArtifacts ?? []);

    // The adapter updates module internally, retrieve it
    // This is a workaround until we refactor adapter to return transformed module
    return (adapter as unknown as { env: { module: Module } }).env.module;
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
