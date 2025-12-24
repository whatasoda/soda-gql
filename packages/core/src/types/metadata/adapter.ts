import type { OperationType } from "../schema";
import type { OperationMetadata } from "./metadata";

/**
 * Input provided to the metadata adapter's transform function.
 */
export type MetadataTransformInput<TMetadata extends OperationMetadata> = {
  /** The type of GraphQL operation (query, mutation, subscription) */
  readonly operationType: OperationType;
  /** The name of the operation */
  readonly operationName: string;
  /** The operation metadata */
  readonly metadata: TMetadata;
  /** The GraphQL document string (useful for generating hashes) */
  readonly document: string;
};

/**
 * Adapter interface for processing metadata at build time.
 * Allows schema-level configuration of default metadata and transformation.
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
   * Called for each operation.
   * Use this to add computed values like persisted query hashes.
   */
  readonly transform?: (input: MetadataTransformInput<TInputMetadata>) => TOutputMetadata;
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
