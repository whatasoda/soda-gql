/**
 * Type definitions for plugin-babel.
 * Simplified from plugin-shared to be self-contained.
 */

import type { BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";

/**
 * Context for transforming a program.
 */
export type TransformProgramContext = {
  readonly filename: string;
  readonly artifactLookup: (id: CanonicalId) => BuilderArtifactElement | undefined;
};

/**
 * Result of a transform pass.
 */
export type TransformPassResult = {
  readonly transformed: boolean;
  readonly runtimeArtifacts?: ReadonlyArray<unknown>;
};

/**
 * Transform adapter interface for Babel AST transformations.
 */
export interface TransformAdapter {
  /**
   * Transform the entire program, replacing GraphQL calls with runtime equivalents.
   */
  transformProgram(context: TransformProgramContext): TransformPassResult;

  /**
   * Insert runtime side effects (e.g., operation registrations) into the program.
   */
  insertRuntimeSideEffects(context: TransformProgramContext, runtimeIR: ReadonlyArray<unknown>): void;
}

/**
 * Factory for creating transform adapter instances.
 */
export interface TransformAdapterFactory {
  readonly id: string;
  create(environment: unknown): TransformAdapter;
}
