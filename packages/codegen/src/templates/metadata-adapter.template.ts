/**
 * Default metadata adapter template for codegen.
 * This is generated when no custom adapter is specified in config.
 */

export const defaultMetadataAdapterTemplate = `\
import type { MetadataAdapter, FragmentMetaInfo, OperationMetadata } from "@soda-gql/core";

/**
 * Default metadata adapter.
 * Aggregates fragment metadata as a readonly array.
 * Uses OperationMetadata as the fragment metadata type.
 *
 * Customize this file to:
 * - Define custom fragment metadata types
 * - Change how fragment metadata is aggregated
 *
 * Note: Operation metadata type is inferred from each operation's metadata callback return type.
 */
export const metadata: MetadataAdapter<
  OperationMetadata,
  readonly (OperationMetadata | undefined)[]
> = {
  aggregateFragmentMetadata: (fragments: readonly FragmentMetaInfo<OperationMetadata>[]) =>
    fragments.map((m) => m.metadata),
};
`;
