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
 * Metadata adapter that defines how model metadata is aggregated
 * and provides schema-level configuration.
 *
 * This adapter allows complete customization of:
 * - Model metadata type (TModelMetadata)
 * - How model metadata is aggregated (aggregateModelMetadata)
 * - Schema-level fixed values available to all operation metadata builders (schemaLevel)
 *
 * Note: Operation metadata type is inferred from the operation's metadata callback return type.
 *
 * @template TModelMetadata - The metadata type returned by model metadata builders
 * @template TAggregatedModelMetadata - The type returned by aggregateModelMetadata
 * @template TSchemaLevel - The type of schema-level configuration values
 */
export type MetadataAdapter<TModelMetadata = unknown, TAggregatedModelMetadata = unknown, TSchemaLevel = unknown> = {
  /**
   * Aggregates metadata from all embedded models in an operation.
   * Called with the metadata from each embedded model.
   * The return type becomes the `modelMetadata` parameter in operation metadata builders.
   */
  readonly aggregateModelMetadata: (models: readonly ModelMetaInfo<TModelMetadata>[]) => TAggregatedModelMetadata;
  /**
   * Schema-level fixed values that are passed to all operation metadata builders.
   * Useful for configuration that should be consistent across all operations.
   */
  readonly schemaLevel?: TSchemaLevel;
};

/**
 * Extracts the type parameters from a MetadataAdapter.
 */
export type ExtractAdapterTypes<T> = T extends MetadataAdapter<infer TModel, infer TAggregated, infer TSchemaLevel>
  ? {
      modelMetadata: TModel;
      aggregatedModelMetadata: TAggregated;
      schemaLevel: TSchemaLevel;
    }
  : never;

/**
 * Generic type for any metadata adapter.
 */
export type AnyMetadataAdapter = MetadataAdapter<any, any, any>;

/**
 * Default adapter that maintains backwards compatibility with the original behavior.
 * Uses OperationMetadata for model metadata and aggregates by collecting metadata into a readonly array.
 */
export type DefaultMetadataAdapter = MetadataAdapter<OperationMetadata, readonly (OperationMetadata | undefined)[]>;

/**
 * Creates the default adapter instance.
 * @internal
 */
export const createDefaultAdapter = (): DefaultMetadataAdapter => ({
  aggregateModelMetadata: (models) => models.map((m) => m.metadata),
});

/**
 * The default adapter instance.
 */
export const defaultMetadataAdapter: DefaultMetadataAdapter = createDefaultAdapter();
