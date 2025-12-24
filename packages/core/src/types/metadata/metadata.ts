import type { DocumentNode } from "graphql";
import type { AnyVarRef } from "../type-foundation/var-ref";

/**
 * Base metadata types that can be attached to operations.
 * These are consumed at runtime by GraphQL clients for HTTP headers,
 * extensions, and custom application-specific values.
 */
export type OperationMetadata = {
  /** HTTP headers to include with the GraphQL request */
  readonly headers?: Record<string, string>;
  /** GraphQL extensions to include in the request payload */
  readonly extensions?: Record<string, unknown>;
  /** Custom arbitrary metadata values for application-specific use */
  readonly custom?: Record<string, unknown>;
};

/**
 * Tools available inside metadata builder callbacks.
 * Access utilities via $var.getName(), $var.getValue(), $var.getInner().
 */
export type MetadataBuilderTools<TVarRefs extends Record<string, AnyVarRef>> = {
  /** Variable references created from the operation's variable definitions */
  readonly $: TVarRefs;
  /** The GraphQL DocumentNode (AST) for this operation */
  readonly document: DocumentNode;
};

/**
 * Metadata builder callback that receives variable tools.
 * Allows metadata to reference operation variables.
 */
export type MetadataBuilder<TVarRefs extends Record<string, AnyVarRef>, TMetadata> = (
  tools: MetadataBuilderTools<TVarRefs>,
) => TMetadata | Promise<TMetadata>;

/**
 * Utility type to extract the metadata type from an operation.
 */
export type ExtractMetadata<T> = T extends { metadata: infer M } ? M : OperationMetadata;
