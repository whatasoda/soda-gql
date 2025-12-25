/**
 * Default metadata adapter template for codegen.
 * This is generated when no custom adapter is specified in config.
 */

export const defaultMetadataAdapterTemplate = `\
import type { FlexibleMetadataAdapter, ModelMetaInfo, OperationMetadata } from "@soda-gql/core";

/**
 * Default metadata adapter.
 * Aggregates model metadata as a readonly array.
 * Uses OperationMetadata as the metadata type.
 *
 * Customize this file to:
 * - Define custom model metadata types
 * - Change how model metadata is aggregated
 * - Define custom operation metadata types
 */
export const adapter: FlexibleMetadataAdapter<
  OperationMetadata,
  readonly (OperationMetadata | undefined)[],
  OperationMetadata
> = {
  aggregateModelMetadata: (models: readonly ModelMetaInfo<OperationMetadata>[]) =>
    models.map((m) => m.metadata),
};
`;
