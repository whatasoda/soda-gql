/**
 * Unified GqlCall types used across all plugins.
 * Generic over the AST node type to support Babel, TypeScript, and SWC.
 */

import type { BuilderArtifactOperation, BuilderArtifactModel, CanonicalId } from "@soda-gql/builder";

/**
 * Base interface for all GraphQL call types.
 * TCallNode represents the AST node type (e.g., t.CallExpression for Babel, ts.CallExpression for TypeScript).
 */
export interface GqlCallBase<TCallNode> {
  readonly canonicalId: CanonicalId;
  readonly builderCall: TCallNode;
}

/**
 * GraphQL model call.
 */
export interface GqlCallModel<TCallNode> extends GqlCallBase<TCallNode> {
  readonly type: "model";
  readonly artifact: BuilderArtifactModel;
}

/**
 * GraphQL operation call.
 */
export interface GqlCallOperation<TCallNode> extends GqlCallBase<TCallNode> {
  readonly type: "operation";
  readonly artifact: BuilderArtifactOperation;
}

/**
 * Union of all GraphQL call types.
 */
export type GqlCall<TCallNode> = GqlCallModel<TCallNode> | GqlCallOperation<TCallNode>;

// Re-export old name for backwards compatibility during transition
/** @deprecated Use `GqlCallOperation` instead */
export type GqlCallInlineOperation<TCallNode> = GqlCallOperation<TCallNode>;
