import type { FieldPath } from "../../composer/field-path-context";
import type { OperationMetadata } from "./metadata";

/**
 * Information about a model's metadata when embedded in an operation.
 */
export type ModelMetaInfo<TModelMetadata> = {
  /** The evaluated metadata from the model, if defined */
  readonly metadata: TModelMetadata | undefined;
  /** Field path where the model was embedded */
  readonly fieldPath: FieldPath | null;
};

/**
 * Flexible metadata adapter that defines how model metadata is aggregated
 * and what types are used for operation metadata.
 *
 * This adapter allows complete customization of:
 * - Model metadata type (TModelMetadata)
 * - How model metadata is aggregated (aggregateModelMetadata)
 * - Operation metadata type (TOperationMetadata)
 *
 * @template TModelMetadata - The metadata type returned by model metadata builders
 * @template TAggregatedModelMetadata - The type returned by aggregateModelMetadata
 * @template TOperationMetadata - The metadata type returned by operation metadata builders
 */
export type FlexibleMetadataAdapter<
  TModelMetadata = unknown,
  TAggregatedModelMetadata = unknown,
  TOperationMetadata = unknown,
> = {
  /**
   * Aggregates metadata from all embedded models in an operation.
   * Called with the metadata from each embedded model.
   * The return type becomes the `modelMetadata` parameter in operation metadata builders.
   */
  readonly aggregateModelMetadata: (models: readonly ModelMetaInfo<TModelMetadata>[]) => TAggregatedModelMetadata;
};

/**
 * Extracts the type parameters from a FlexibleMetadataAdapter.
 */
export type ExtractAdapterTypes<T> = T extends FlexibleMetadataAdapter<infer TModel, infer TAggregated, infer TOp>
  ? {
      modelMetadata: TModel;
      aggregatedModelMetadata: TAggregated;
      operationMetadata: TOp;
    }
  : never;

/**
 * Generic type for any flexible metadata adapter.
 */
export type AnyFlexibleMetadataAdapter = FlexibleMetadataAdapter<unknown, unknown, unknown>;

/**
 * Default adapter that maintains backwards compatibility with the original behavior.
 * Uses OperationMetadata for both model and operation metadata,
 * and aggregates by collecting metadata into a readonly array.
 */
export type DefaultFlexibleMetadataAdapter = FlexibleMetadataAdapter<
  OperationMetadata,
  readonly (OperationMetadata | undefined)[],
  OperationMetadata
>;

/**
 * Creates the default adapter instance.
 * @internal
 */
export const createDefaultAdapter = (): DefaultFlexibleMetadataAdapter => ({
  aggregateModelMetadata: (models) => models.map((m) => m.metadata),
});

/**
 * The default adapter instance.
 */
export const defaultFlexibleMetadataAdapter: DefaultFlexibleMetadataAdapter = createDefaultAdapter();
