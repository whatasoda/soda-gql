/**
 * Transform adapter interfaces and IR types for TypeScript transformations.
 * Simplified from plugin-shared to include only types used by plugin-tsc.
 */

import type { BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";

/**
 * Context provided to transform operations.
 */
export type TransformProgramContext = {
  readonly filename: string;
  readonly artifactLookup: (id: CanonicalId) => BuilderArtifactElement | undefined;
  readonly runtimeModule: string;
  readonly compilerOptions?: unknown;
  /**
   * Absolute path to the graphql-system file.
   * When transforming this file, replace its content with an empty module stub.
   */
  readonly graphqlSystemFilePath?: string;
};
