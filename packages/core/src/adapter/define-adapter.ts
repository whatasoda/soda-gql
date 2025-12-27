import type { Adapter } from "../types/metadata";

/**
 * Helper function for defining a unified adapter with helpers and metadata.
 * Provides type inference for helpers, aggregateFragmentMetadata and schemaLevel.
 *
 * @example
 * ```typescript
 * import { defineAdapter } from "@soda-gql/core/adapter";
 * import type { FragmentMetaInfo, OperationMetadata } from "@soda-gql/core";
 *
 * export const adapter = defineAdapter({
 *   helpers: {
 *     auth: {
 *       requiresLogin: () => ({ requiresAuth: true }),
 *       adminOnly: () => ({ requiresAuth: true, role: "admin" }),
 *     },
 *   },
 *   metadata: {
 *     aggregateFragmentMetadata: (fragments: readonly FragmentMetaInfo<OperationMetadata>[]) =>
 *       fragments.map((m) => m.metadata),
 *     schemaLevel: {
 *       apiVersion: "v2",
 *     },
 *   },
 * });
 * ```
 */
export const defineAdapter = <
  THelpers extends object = object,
  TFragmentMetadata = unknown,
  TAggregatedFragmentMetadata = unknown,
  TSchemaLevel = unknown,
>(
  adapter: Adapter<THelpers, TFragmentMetadata, TAggregatedFragmentMetadata, TSchemaLevel>,
): Adapter<THelpers, TFragmentMetadata, TAggregatedFragmentMetadata, TSchemaLevel> => adapter;
