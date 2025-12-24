/**
 * Unified GqlCall types used across all plugins.
 * Generic over the AST node type to support Babel, TypeScript, and SWC.
 */

import type { BuilderArtifactInlineOperation, BuilderArtifactModel, CanonicalId } from "@soda-gql/builder";

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
 * GraphQL inline operation call.
 */
export interface GqlCallInlineOperation<TCallNode> extends GqlCallBase<TCallNode> {
  readonly type: "inlineOperation";
  readonly artifact: BuilderArtifactInlineOperation;
}

/**
 * Union of all GraphQL call types.
 */
export type GqlCall<TCallNode> = GqlCallModel<TCallNode> | GqlCallInlineOperation<TCallNode>;
