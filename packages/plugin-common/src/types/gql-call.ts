/**
 * Unified GqlCall types used across all plugins.
 */

import type { BuilderArtifactFragment, BuilderArtifactOperation } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";

/**
 * Base interface for all GraphQL call types.
 */
export interface GqlCallBase {
  readonly canonicalId: CanonicalId;
}

/**
 * GraphQL fragment call.
 */
export interface GqlCallFragment extends GqlCallBase {
  readonly type: "fragment";
  readonly artifact: BuilderArtifactFragment;
}

/**
 * GraphQL operation call.
 */
export interface GqlCallOperation extends GqlCallBase {
  readonly type: "operation";
  readonly artifact: BuilderArtifactOperation;
}

/**
 * Union of all GraphQL call types.
 */
export type GqlCall = GqlCallFragment | GqlCallOperation;
