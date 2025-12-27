import type { FieldPath } from "../../composer/field-path-context";
import type { OperationMetadata } from "./metadata";

/**
 * Information about a fragment's metadata when embedded in an operation.
 */
export type FragmentMetaInfo<TFragmentMetadata> = {
  /** The evaluated metadata from the fragment, if defined */
  readonly metadata: TFragmentMetadata | undefined;
  /** Field path where the fragment was embedded */
  readonly fieldPath: FieldPath | null;
};

/**
 * Metadata adapter that defines how fragment metadata is aggregated
 * and provides schema-level configuration.
 *
 * This adapter allows complete customization of:
 * - Fragment metadata type (TFragmentMetadata)
 * - How fragment metadata is aggregated (aggregateFragmentMetadata)
 * - Schema-level fixed values available to all operation metadata builders (schemaLevel)
 *
 * Note: Operation metadata type is inferred from the operation's metadata callback return type.
 *
 * @template TFragmentMetadata - The metadata type returned by fragment metadata builders
 * @template TAggregatedFragmentMetadata - The type returned by aggregateFragmentMetadata
 * @template TSchemaLevel - The type of schema-level configuration values
 */
export type MetadataAdapter<TFragmentMetadata = unknown, TAggregatedFragmentMetadata = unknown, TSchemaLevel = unknown> = {
  /**
   * Aggregates metadata from all embedded fragments in an operation.
   * Called with the metadata from each embedded fragment.
   * The return type becomes the `fragmentMetadata` parameter in operation metadata builders.
   */
  readonly aggregateFragmentMetadata: (fragments: readonly FragmentMetaInfo<TFragmentMetadata>[]) => TAggregatedFragmentMetadata;
  /**
   * Schema-level fixed values that are passed to all operation metadata builders.
   * Useful for configuration that should be consistent across all operations.
   */
  readonly schemaLevel?: TSchemaLevel;
};

/**
 * Extracts the type parameters from a MetadataAdapter.
 */
export type ExtractAdapterTypes<T> = T extends MetadataAdapter<infer TFragment, infer TAggregated, infer TSchemaLevel>
  ? {
      fragmentMetadata: TFragment;
      aggregatedFragmentMetadata: TAggregated;
      schemaLevel: TSchemaLevel;
    }
  : never;

/**
 * Generic type for any metadata adapter.
 */
export type AnyMetadataAdapter = MetadataAdapter<any, any, any>;

/**
 * Default adapter that maintains backwards compatibility with the original behavior.
 * Uses OperationMetadata for fragment metadata and aggregates by collecting metadata into a readonly array.
 */
export type DefaultMetadataAdapter = MetadataAdapter<OperationMetadata, readonly (OperationMetadata | undefined)[]>;

/**
 * Creates the default adapter instance.
 * @internal
 */
export const createDefaultAdapter = (): DefaultMetadataAdapter => ({
  aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
});

/**
 * The default adapter instance.
 */
export const defaultMetadataAdapter: DefaultMetadataAdapter = createDefaultAdapter();
