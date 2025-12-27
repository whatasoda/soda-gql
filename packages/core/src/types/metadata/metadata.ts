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
 * @template TAggregatedFragmentMetadata - The aggregated fragment metadata type from the adapter
 * @template TSchemaLevel - The schema-level configuration type from the adapter
 */
export type MetadataBuilderTools<
  TVarRefs extends Record<string, AnyVarRef>,
  TAggregatedFragmentMetadata = readonly (OperationMetadata | undefined)[],
  TSchemaLevel = unknown,
> = {
  /** Variable references created from the operation's variable definitions */
  readonly $: TVarRefs;
  /** The GraphQL DocumentNode (AST) for this operation */
  readonly document: DocumentNode;
  /** Aggregated metadata from embedded fragments, evaluated before operation metadata */
  readonly fragmentMetadata?: TAggregatedFragmentMetadata;
  /** Schema-level fixed values from the adapter */
  readonly schemaLevel?: TSchemaLevel;
};

/**
 * Metadata builder callback that receives variable tools.
 * Allows metadata to reference operation variables.
 *
 * @template TVarRefs - Variable references from the operation
 * @template TMetadata - The metadata type returned by this builder
 * @template TAggregatedFragmentMetadata - The aggregated fragment metadata type from the adapter
 * @template TSchemaLevel - The schema-level configuration type from the adapter
 */
export type MetadataBuilder<
  TVarRefs extends Record<string, AnyVarRef>,
  TMetadata,
  TAggregatedFragmentMetadata = readonly (OperationMetadata | undefined)[],
  TSchemaLevel = unknown,
> = (tools: MetadataBuilderTools<TVarRefs, TAggregatedFragmentMetadata, TSchemaLevel>) => TMetadata | Promise<TMetadata>;

/**
 * Utility type to extract the metadata type from an operation.
 */
export type ExtractMetadata<T> = T extends { metadata: infer M } ? M : OperationMetadata;

/**
 * Tools available inside fragment metadata builder callbacks.
 * Unlike operation metadata, fragments don't have their own document.
 */
export type FragmentMetadataBuilderTools<TVarRefs extends Record<string, AnyVarRef>> = {
  /** Variable references created from the fragment's variable definitions */
  readonly $: TVarRefs;
};

/**
 * Metadata builder callback for fragments.
 * Allows metadata to reference fragment variables.
 * Supports both sync and async metadata generation.
 */
export type FragmentMetadataBuilder<TVarRefs extends Record<string, AnyVarRef>, TMetadata = OperationMetadata> = (
  tools: FragmentMetadataBuilderTools<TVarRefs>,
) => TMetadata | Promise<TMetadata>;
