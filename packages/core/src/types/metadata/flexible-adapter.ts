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
 * Flexible metadata adapter that defines how model metadata is aggregated.
 *
 * This adapter allows complete customization of:
 * - Model metadata type (TModelMetadata)
 * - How model metadata is aggregated (aggregateModelMetadata)
 *
 * Note: Operation metadata type is inferred from the operation's metadata callback return type.
 *
 * @template TModelMetadata - The metadata type returned by model metadata builders
 * @template TAggregatedModelMetadata - The type returned by aggregateModelMetadata
 */
export type FlexibleMetadataAdapter<TModelMetadata = unknown, TAggregatedModelMetadata = unknown> = {
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
export type ExtractAdapterTypes<T> = T extends FlexibleMetadataAdapter<infer TModel, infer TAggregated>
  ? {
      modelMetadata: TModel;
      aggregatedModelMetadata: TAggregated;
    }
  : never;

/**
 * Generic type for any flexible metadata adapter.
 */
export type AnyFlexibleMetadataAdapter = FlexibleMetadataAdapter<any, any>;

/**
 * Default adapter that maintains backwards compatibility with the original behavior.
 * Uses OperationMetadata for model metadata and aggregates by collecting metadata into a readonly array.
 */
export type DefaultFlexibleMetadataAdapter = FlexibleMetadataAdapter<
  OperationMetadata,
  readonly (OperationMetadata | undefined)[]
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
