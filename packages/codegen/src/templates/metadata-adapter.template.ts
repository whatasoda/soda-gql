/**
 * Default metadata adapter template for codegen.
 * This is generated when no custom adapter is specified in config.
 */

export const defaultMetadataAdapterTemplate = `\
import type { FlexibleMetadataAdapter, ModelMetaInfo, OperationMetadata } from "@soda-gql/core";

/**
 * Default metadata adapter.
 * Aggregates model metadata as a readonly array.
 * Uses OperationMetadata as the model metadata type.
 *
 * Customize this file to:
 * - Define custom model metadata types
 * - Change how model metadata is aggregated
 *
 * Note: Operation metadata type is inferred from each operation's metadata callback return type.
 */
export const adapter: FlexibleMetadataAdapter<
  OperationMetadata,
  readonly (OperationMetadata | undefined)[]
> = {
  aggregateModelMetadata: (models: readonly ModelMetaInfo<OperationMetadata>[]) =>
    models.map((m) => m.metadata),
};
`;
