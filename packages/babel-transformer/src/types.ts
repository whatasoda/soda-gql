/**
 * Type definitions for babel-transformer.
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
