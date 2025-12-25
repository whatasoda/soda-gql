import type { MetadataAdapter } from "../types/metadata";

/**
 * Helper function for defining a typed metadata adapter.
 * Provides type inference for aggregateModelMetadata and schemaLevel.
 *
 * @example
 * ```typescript
 * import { defineAdapter } from "@soda-gql/core/adapter";
 * import type { ModelMetaInfo, OperationMetadata } from "@soda-gql/core";
 *
 * export const adapter = defineAdapter({
 *   aggregateModelMetadata: (models: readonly ModelMetaInfo<OperationMetadata>[]) =>
 *     models.map((m) => m.metadata),
 *   schemaLevel: {
 *     apiVersion: "v2",
 *   },
 * });
 * ```
 */
export const defineAdapter = <TModelMetadata = unknown, TAggregatedModelMetadata = unknown, TSchemaLevel = unknown>(
  adapter: MetadataAdapter<TModelMetadata, TAggregatedModelMetadata, TSchemaLevel>,
): MetadataAdapter<TModelMetadata, TAggregatedModelMetadata, TSchemaLevel> => adapter;
