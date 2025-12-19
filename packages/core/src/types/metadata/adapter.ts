import type { OperationType } from "../schema";
import type { OperationMetadata, SliceMetadata } from "./metadata";

/**
 * Input provided to the metadata adapter's transform function.
 */
export type MetadataTransformInput<TMetadata extends OperationMetadata> = {
  /** The type of GraphQL operation (query, mutation, subscription) */
  readonly operationType: OperationType;
  /** The name of the operation */
  readonly operationName: string;
  /** The merged metadata from operation and slices */
  readonly metadata: TMetadata;
  /** The GraphQL document string (useful for generating hashes) */
  readonly document: string;
};

/**
 * Adapter interface for processing metadata at build time.
 * Allows schema-level configuration of default metadata, transformation,
 * and custom merge strategies for slice metadata.
 *
 * @template TInputMetadata - The metadata type accepted by the adapter
 * @template TOutputMetadata - The metadata type produced after transformation
 */
export type MetadataAdapter<
  TInputMetadata extends OperationMetadata = OperationMetadata,
  TOutputMetadata extends OperationMetadata = TInputMetadata,
> = {
  /** Schema-level default metadata applied to all operations */
  readonly defaults: TInputMetadata;

  /**
   * Transform/process metadata at build time.
   * Called for each operation with merged metadata from slices.
   * Use this to add computed values like persisted query hashes.
   */
  readonly transform?: (input: MetadataTransformInput<TInputMetadata>) => TOutputMetadata;

  /**
   * Custom merge strategy for combining slice metadata into operation metadata.
   * If not provided, a default shallow merge is used where operation metadata
   * takes precedence over slice metadata.
   *
   * @param operationMetadata - Metadata defined on the operation itself
   * @param sliceMetadata - Array of metadata from all embedded slices
   * @returns Merged metadata to be used for the operation
   */
  readonly mergeSliceMetadata?: (operationMetadata: TInputMetadata, sliceMetadata: readonly SliceMetadata[]) => TInputMetadata;
};

/**
 * Generic type for any metadata adapter.
 */
export type AnyMetadataAdapter = MetadataAdapter<OperationMetadata, OperationMetadata>;

/**
 * Extracts the input metadata type from an adapter.
 */
export type AdapterInputMetadata<T extends AnyMetadataAdapter> = T extends MetadataAdapter<infer I, infer _O>
  ? I
  : OperationMetadata;

/**
 * Extracts the output metadata type from an adapter.
 */
export type AdapterOutputMetadata<T extends AnyMetadataAdapter> = T extends MetadataAdapter<infer _I, infer O>
  ? O
  : OperationMetadata;
