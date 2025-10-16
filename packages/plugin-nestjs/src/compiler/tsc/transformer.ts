/**
 * TypeScript transformer for Nest CLI integration.
 *
 * This transformer integrates soda-gql's zero-runtime transformations
 * into the Nest CLI build process when using `builder: "tsc"`.
 */

import { type TypeScriptAdapter, typescriptTransformAdapterFactory } from "@soda-gql/plugin-shared";
import type * as ts from "typescript";
import { prepareTransformState } from "../core/prepare-transform-state.js";

/**
 * Configuration for the soda-gql TypeScript transformer.
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
 * Create a TypeScript transformer for soda-gql.
 *
 * This factory signature matches the TypeScript compiler plugin API
 * expected by Nest CLI and other TypeScript tooling.
 *
 * @example
 * ```ts
 * // In tsconfig.json or nest-cli.json:
 * {
 *   "compilerOptions": {
 *     "plugins": [
 *       {
 *         "transform": "@soda-gql/plugin-nestjs/compiler/tsc",
 *         "configPath": "./soda-gql.config.ts"
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export function createSodaGqlTransformer(
  program: ts.Program,
  rawConfig?: Partial<TransformerConfig>,
): ts.TransformerFactory<ts.SourceFile> {
  const config: TransformerConfig = {
    configPath: rawConfig?.configPath,
    project: rawConfig?.project,
    importIdentifier: rawConfig?.importIdentifier ?? "@/graphql-system",
    enabled: rawConfig?.enabled ?? true,
  };

  // Short-circuit if disabled
  if (!config.enabled) {
    return (context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => sourceFile;
  }

  // Prepare transform state using coordinator
  const prepareResult = prepareTransformState({
    configPath: config.configPath,
    project: config.project,
    importIdentifier: config.importIdentifier,
  });

  // Handle preparation errors
  if (prepareResult.isErr()) {
    const error = prepareResult.error;
    if (error.type === "BLOCKING_NOT_SUPPORTED") {
      console.error(`[@soda-gql/plugin-nestjs] ${error.message}`);
    } else if (error.type === "PLUGIN_ERROR") {
      const pluginError = error.error;
      console.error(
        `[@soda-gql/plugin-nestjs] Transform preparation failed (${pluginError.code}):`,
        pluginError.message,
      );
    }
    // Return no-op transformer
    return (context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => sourceFile;
  }

  const prepared = prepareResult.value;

  return (context: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {
      // Skip declaration files
      if (sourceFile.isDeclarationFile) {
        return sourceFile;
      }

      // Create TypeScript adapter
      const adapter = typescriptTransformAdapterFactory.create({
        sourceFile,
        context,
        typescript: require("typescript"),
      }) as TypeScriptAdapter;

      // Transform the program
      const transformContext = {
        filename: sourceFile.fileName,
        artifactLookup: (canonicalId: import("@soda-gql/builder").CanonicalId) => prepared.allArtifacts[canonicalId],
      };

      const transformResult = adapter.transformProgram(transformContext);

      if (!transformResult.transformed) {
        return sourceFile;
      }

      // Insert runtime side effects
      adapter.insertRuntimeSideEffects(transformContext, transformResult.runtimeArtifacts ?? []);

      // The adapter updates sourceFile internally, retrieve it
      // This is a workaround until we refactor adapter to return transformed source
      return (adapter as unknown as { env: { sourceFile: ts.SourceFile } }).env.sourceFile;
    };
  };
}

/**
 * Default export for Nest CLI plugin resolution.
 */
export default createSodaGqlTransformer;
