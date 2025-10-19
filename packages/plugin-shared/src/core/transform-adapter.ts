/**
 * Library-neutral transform adapter interface.
 *
 * This interface defines the contract for transform adapters that can work with
 * different AST libraries (Babel, SWC, ESTree, esbuild, etc.).
 */

import type { BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type { PluginError } from "../state";
import type { DefinitionMetadataMap, GraphQLCallAnalysis, GraphQLCallIR } from "./ir";

/**
 * Context provided to transform operations.
 */
export type TransformProgramContext = {
  readonly filename: string;
  readonly artifactLookup: (id: CanonicalId) => BuilderArtifactElement | undefined;
  readonly runtimeModule: string;
};

/**
 * Result of a transform pass.
 */
export type TransformPassResult = {
  readonly transformed: boolean;
  readonly runtimeArtifacts?: ReadonlyArray<GraphQLCallIR>;
  readonly errors?: ReadonlyArray<PluginError>;
};

/**
 * Transform adapter interface - implement this for each AST library.
 */
export interface TransformAdapter {
  /**
   * Collect metadata about GraphQL definitions in the program.
   * Returns a map of definition identifiers to their metadata.
   */
  collectDefinitionMetadata(context: TransformProgramContext): DefinitionMetadataMap;

  /**
   * Analyze a candidate call expression to determine if it's a GraphQL call.
   * Returns the IR representation or an error.
   *
   * @param context Transform context
   * @param candidate Adapter-specific AST node (e.g., Babel CallExpression)
   */
  analyzeCall(context: TransformProgramContext, candidate: unknown): GraphQLCallAnalysis | PluginError;

  /**
   * Transform the entire program, replacing GraphQL calls with runtime equivalents.
   * Returns the result of the transformation including any runtime artifacts.
   */
  transformProgram(context: TransformProgramContext): TransformPassResult;

  /**
   * Insert runtime side effects (e.g., operation registrations) into the program.
   * This is called after transformProgram to inject additional runtime calls.
   */
  insertRuntimeSideEffects(context: TransformProgramContext, runtimeIR: ReadonlyArray<GraphQLCallIR>): void;
}

/**
 * Factory for creating transform adapter instances.
 */
export interface TransformAdapterFactory {
  readonly id: string;
  create(environment: unknown): TransformAdapter;
}
