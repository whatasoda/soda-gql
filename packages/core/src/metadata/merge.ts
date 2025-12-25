import type { OperationMetadata } from "../types/metadata";

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
