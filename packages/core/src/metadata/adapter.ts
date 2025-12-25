import type { MetadataAdapter, MetadataTransformInput, OperationMetadata } from "../types/metadata";
import { mergeWithDefaults } from "./merge";

/**
 * Creates a type-safe metadata adapter for a schema.
 * The adapter defines how metadata is processed at build time.
 *
 * @example
 * ```typescript
 * import { createMetadataAdapter } from "@soda-gql/core/adapter";
 * import { createHash } from "crypto";
 *
 * export const metadataAdapter = createMetadataAdapter({
 *   defaults: {
 *     headers: { "X-GraphQL-Client": "soda-gql" },
 *   },
 *
 *   transform: ({ document, metadata }) => ({
 *     ...metadata,
 *     extensions: {
 *       ...metadata.extensions,
 *       persistedQuery: {
 *         version: 1,
 *         sha256Hash: createHash("sha256").update(document).digest("hex"),
 *       },
 *     },
 *   }),
 * });
 * ```
 */
export const createMetadataAdapter = <
  TInputMetadata extends OperationMetadata = OperationMetadata,
  TOutputMetadata extends OperationMetadata = TInputMetadata,
>(
  adapter: MetadataAdapter<TInputMetadata, TOutputMetadata>,
): MetadataAdapter<TInputMetadata, TOutputMetadata> => adapter;

/**
 * Processes metadata through an adapter, applying defaults and
 * running the transform function.
 *
 * @param adapter - The metadata adapter to use
 * @param operationMetadata - Metadata defined on the operation
 * @param transformInput - Additional input for the transform function
 * @returns Processed metadata ready for runtime use
 */
export const processMetadata = <TInputMetadata extends OperationMetadata, TOutputMetadata extends OperationMetadata>(
  adapter: MetadataAdapter<TInputMetadata, TOutputMetadata>,
  operationMetadata: TInputMetadata | undefined,
  transformInput: Omit<MetadataTransformInput<TInputMetadata>, "metadata">,
): TOutputMetadata => {
  // Step 1: Merge with schema defaults
  const withDefaults = mergeWithDefaults(adapter.defaults, operationMetadata ?? ({} as TInputMetadata));

  // Step 2: Apply transform if provided
  if (adapter.transform) {
    return adapter.transform({
      ...transformInput,
      metadata: withDefaults,
    });
  }

  return withDefaults as unknown as TOutputMetadata;
};

/**
 * Creates a no-op metadata adapter that passes through metadata unchanged.
 * Useful when no metadata processing is needed.
 */
export const createNoopMetadataAdapter = (): MetadataAdapter<OperationMetadata, OperationMetadata> => ({
  defaults: {},
});
