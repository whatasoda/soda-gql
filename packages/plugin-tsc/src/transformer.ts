/**
 * TypeScript transformer for Nest CLI integration.
 *
 * This transformer integrates soda-gql's zero-runtime transformations
 * into the Nest CLI build process when using `builder: "tsc"`.
 */

import type { CanonicalId } from "@soda-gql/common";
import type * as ts from "typescript";
import { createAfterStubTransformer, type TypeScriptAdapter, typescriptTransformAdapterFactory } from "./internal/ts-adapter/typescript-adapter.js";
import { prepareTransformState } from "./internal/state/prepare-transform-state.js";

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
 *         "transform": "@soda-gql/plugin-tsc",
 *         "configPath": "./soda-gql.config.ts"
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export function createSodaGqlTransformer(
  _program: ts.Program,
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
    return (_context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => sourceFile;
  }

  // Prepare transform state using coordinator
  const prepareResult = prepareTransformState({
    configPath: config.configPath,
    project: config.project,
    importIdentifier: config.importIdentifier,
    packageLabel: "@soda-gql/plugin-tsc",
  });

  // Handle preparation errors
  if (prepareResult.isErr()) {
    const error = prepareResult.error;
    if (error.type === "PLUGIN_ERROR") {
      const pluginError = error.error;
      console.error(`[@soda-gql/plugin-tsc] Transform preparation failed (${pluginError.code}):`, pluginError.message);
    }
    // Return no-op transformer
    return (_context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => sourceFile;
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
      });

      // Transform the program
      const transformContext = {
        filename: sourceFile.fileName,
        artifactLookup: (canonicalId: CanonicalId) => prepared.allArtifacts[canonicalId],
        runtimeModule: prepared.importIdentifier,
        compilerOptions: context.getCompilerOptions(),
        graphqlSystemFilePath: prepared.graphqlSystemPath,
      };

      const transformResult = adapter.transformProgram(transformContext);

      if (!transformResult.transformed) {
        return sourceFile;
      }

      // Insert runtime side effects
      adapter.insertRuntimeSideEffects();

      // The adapter updates sourceFile internally, retrieve it
      // This is a workaround until we refactor adapter to return transformed source
      return (adapter as unknown as { env: { sourceFile: ts.SourceFile } }).env.sourceFile;
    };
  };
}

/**
 * Nest CLI plugin hook: before() transformer.
 *
 * This function is called by Nest CLI with (options, program) signature.
 * It must be exported as a top-level named export for CommonJS compatibility.
 */
export function before(options: Partial<TransformerConfig> = {}, program?: ts.Program): ts.TransformerFactory<ts.SourceFile> {
  if (!program) {
    throw new Error("[@soda-gql/plugin-tsc] Nest CLI invoked the transformer without a Program instance.");
  }
  return createSodaGqlTransformer(program, options);
}

/**
 * Nest CLI plugin hook: after() transformer.
 *
 * This runs after TypeScript's own transformers (including CommonJS downleveling).
 * It replaces require() calls for the graphql-system module with lightweight stubs
 * to prevent the heavy module from being loaded at runtime.
 */
export function after(options: Partial<TransformerConfig> = {}): ts.TransformerFactory<ts.SourceFile> {
  const config: TransformerConfig = {
    configPath: options.configPath,
    project: options.project,
    importIdentifier: options.importIdentifier ?? "@/graphql-system",
    enabled: options.enabled ?? true,
  };

  // Short-circuit if disabled
  if (!config.enabled) {
    return (_context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => sourceFile;
  }

  return createAfterStubTransformer(config.importIdentifier ?? "@/graphql-system", require("typescript"));
}

/**
 * Nest CLI plugin interface object.
 * Provides the before() and after() hooks for TypeScript transformations.
 */
const nestCliPlugin = { before, after };

/**
 * Default export for Nest CLI plugin resolution.
 */
export default nestCliPlugin;
