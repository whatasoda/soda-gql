import type { Adapter } from "../types/metadata";

/**
 * Helper function for defining a unified adapter with helpers, metadata, and document transformation.
 * Provides type inference for helpers, aggregateFragmentMetadata, schemaLevel, and transformDocument.
 *
 * @example Basic adapter with helpers and metadata
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
 *
 * @example Adapter with document transformation
 * ```typescript
 * import { defineAdapter } from "@soda-gql/core/adapter";
 * import { Kind, visit } from "graphql";
 *
 * export const adapter = defineAdapter({
 *   transformDocument: ({ document, operationType }) => {
 *     // Add @auth directive to all queries
 *     if (operationType === "query") {
 *       return visit(document, {
 *         OperationDefinition: (node) => ({
 *           ...node,
 *           directives: [
 *             ...(node.directives ?? []),
 *             { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "auth" } },
 *           ],
 *         }),
 *       });
 *     }
 *     return document;
 *   },
 * });
 * ```
 *
 * @example Using helpers for operation-level transform functions (recommended)
 * ```typescript
 * // Define transform functions as helpers for reusability
 * const adapter = defineAdapter({
 *   helpers: {
 *     transform: {
 *       addCacheDirective: (ttl: number) => ({ document }) => {
 *         return visit(document, { ... });
 *       },
 *     },
 *   },
 * });
 *
 * // Use helper in operation - clean and declarative
 * gql(({ query, transform }) =>
 *   query.operation({
 *     name: "GetUser",
 *     transformDocument: transform.addCacheDirective(300),
 *     fields: ({ f }) => ({ ... }),
 *   }),
 * );
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
