/**
 * Unified metadata types used across all plugins.
 */

/**
 * Metadata for a GraphQL definition.
 */
export type GqlDefinitionMetadata = {
  readonly astPath: string;
  readonly isTopLevel: boolean;
  readonly isExported: boolean;
  readonly exportBinding?: string;
};
