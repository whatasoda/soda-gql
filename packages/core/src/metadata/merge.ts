import type { OperationMetadata, SliceMetadata } from "../types/metadata";

/**
 * Default merge strategy for combining slice metadata with operation metadata.
 * Performs a shallow merge where operation-level values take precedence.
 *
 * @param operationMetadata - Metadata defined on the operation itself
 * @param sliceMetadataList - Array of metadata from all embedded slices
 * @returns Merged metadata with operation values taking precedence
 */
export const defaultMergeSliceMetadata = <TMetadata extends OperationMetadata>(
  operationMetadata: TMetadata,
  sliceMetadataList: readonly SliceMetadata[],
): TMetadata => {
  // Merge all slice metadata together (later slices override earlier ones)
  const mergedSliceMetadata = sliceMetadataList.reduce<OperationMetadata>(
    (acc, slice) => ({
      headers: { ...acc.headers, ...slice.headers },
      extensions: { ...acc.extensions, ...slice.extensions },
      custom: { ...acc.custom, ...slice.custom },
    }),
    { headers: {}, extensions: {}, custom: {} },
  );

  // Operation metadata takes precedence over merged slice metadata
  return {
    ...operationMetadata,
    headers: { ...mergedSliceMetadata.headers, ...operationMetadata.headers },
    extensions: { ...mergedSliceMetadata.extensions, ...operationMetadata.extensions },
    custom: { ...mergedSliceMetadata.custom, ...operationMetadata.custom },
  } as TMetadata;
};

/**
 * Merge schema-level default metadata with operation-level metadata.
 * Schema defaults are applied first, then operation metadata overrides.
 *
 * @param defaults - Schema-level default metadata
 * @param operationMetadata - Operation-specific metadata
 * @returns Merged metadata with operation values taking precedence
 */
export const mergeWithDefaults = <TMetadata extends OperationMetadata>(
  defaults: TMetadata,
  operationMetadata: TMetadata,
): TMetadata => {
  return {
    ...defaults,
    ...operationMetadata,
    headers: { ...defaults.headers, ...operationMetadata.headers },
    extensions: { ...defaults.extensions, ...operationMetadata.extensions },
    custom: { ...defaults.custom, ...operationMetadata.custom },
  } as TMetadata;
};
