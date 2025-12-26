/**
 * Unified GqlCall types used across all plugins.
 */

import type { BuilderArtifactModel, BuilderArtifactOperation } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";

/**
 * Base interface for all GraphQL call types.
 */
export interface GqlCallBase {
  readonly canonicalId: CanonicalId;
}

/**
 * GraphQL model call.
 */
export interface GqlCallModel extends GqlCallBase {
  readonly type: "model";
  readonly artifact: BuilderArtifactModel;
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
export type GqlCall = GqlCallModel | GqlCallOperation;
