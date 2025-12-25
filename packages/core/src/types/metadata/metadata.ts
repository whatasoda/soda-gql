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
 *
 * @template TVarRefs - Variable references from the operation
 * @template TAggregatedModelMetadata - The aggregated model metadata type from the adapter
 */
export type MetadataBuilderTools<
  TVarRefs extends Record<string, AnyVarRef>,
  TAggregatedModelMetadata = readonly (OperationMetadata | undefined)[],
> = {
  /** Variable references created from the operation's variable definitions */
  readonly $: TVarRefs;
  /** The GraphQL DocumentNode (AST) for this operation */
  readonly document: DocumentNode;
  /** Aggregated metadata from embedded models, evaluated before operation metadata */
  readonly modelMetadata?: TAggregatedModelMetadata;
};

/**
 * Metadata builder callback that receives variable tools.
 * Allows metadata to reference operation variables.
 *
 * @template TVarRefs - Variable references from the operation
 * @template TMetadata - The metadata type returned by this builder
 * @template TAggregatedModelMetadata - The aggregated model metadata type from the adapter
 */
export type MetadataBuilder<
  TVarRefs extends Record<string, AnyVarRef>,
  TMetadata,
  TAggregatedModelMetadata = readonly (OperationMetadata | undefined)[],
> = (tools: MetadataBuilderTools<TVarRefs, TAggregatedModelMetadata>) => TMetadata | Promise<TMetadata>;

/**
 * Utility type to extract the metadata type from an operation.
 */
export type ExtractMetadata<T> = T extends { metadata: infer M } ? M : OperationMetadata;

/**
 * Tools available inside model metadata builder callbacks.
 * Unlike operation metadata, models don't have their own document.
 */
export type ModelMetadataBuilderTools<TVarRefs extends Record<string, AnyVarRef>> = {
  /** Variable references created from the model's variable definitions */
  readonly $: TVarRefs;
};

/**
 * Metadata builder callback for models.
 * Allows metadata to reference model variables.
 * Supports both sync and async metadata generation.
 */
export type ModelMetadataBuilder<TVarRefs extends Record<string, AnyVarRef>, TMetadata = OperationMetadata> = (
  tools: ModelMetadataBuilderTools<TVarRefs>,
) => TMetadata | Promise<TMetadata>;
