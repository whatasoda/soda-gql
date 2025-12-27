import type { MetadataAdapter } from "../types/metadata";

/**
 * Helper function for defining a typed metadata adapter.
 * Provides type inference for aggregateFragmentMetadata and schemaLevel.
 *
 * @example
 * ```typescript
 * import { defineAdapter } from "@soda-gql/core/adapter";
 * import type { FragmentMetaInfo, OperationMetadata } from "@soda-gql/core";
 *
 * export const adapter = defineAdapter({
 *   aggregateFragmentMetadata: (fragments: readonly FragmentMetaInfo<OperationMetadata>[]) =>
 *     fragments.map((m) => m.metadata),
 *   schemaLevel: {
 *     apiVersion: "v2",
 *   },
 * });
 * ```
 */
export const defineAdapter = <TFragmentMetadata = unknown, TAggregatedFragmentMetadata = unknown, TSchemaLevel = unknown>(
  adapter: MetadataAdapter<TFragmentMetadata, TAggregatedFragmentMetadata, TSchemaLevel>,
): MetadataAdapter<TFragmentMetadata, TAggregatedFragmentMetadata, TSchemaLevel> => adapter;
