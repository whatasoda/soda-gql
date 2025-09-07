/**
 * Field Selection type definitions
 * Copied from spec - not imported from /specs directory
 */

/**
 * Helper type to extract relation fields from __relation__ property
 */
type ExtractRelations<T> = T extends { __relation__: infer R } ? R : {};

/**
 * Helper type to extract non-relation fields (excluding __relation__)
 */
type ExtractNonRelations<T> = Omit<T, "__relation__">;

/**
 * Basic field selection for GraphQL types with proper type inference
 * Relations are explicitly defined in __relation__ property
 */
export type FieldSelection<T = any> = {
  // Regular fields (non-relations)
  [K in keyof ExtractNonRelations<T>]?: boolean;
} & {
  // Relation fields from __relation__
  [K in keyof ExtractRelations<T>]?: boolean | FieldSelection<ExtractRelations<T>[K]>;
};

/**
 * Deep field selection that allows nested object traversal
 * Uses __relation__ to determine traversable relations
 */
export type DeepFieldSelection<T = any> = {
  // Regular fields (non-relations)
  [K in keyof ExtractNonRelations<T>]?: boolean;
} & {
  // Relation fields from __relation__ with deep traversal
  [K in keyof ExtractRelations<T>]?: ExtractRelations<T>[K] extends Array<infer U>
    ? DeepFieldSelection<U>
    : DeepFieldSelection<ExtractRelations<T>[K]>;
};

/**
 * Conditional field selection based on type
 * Respects __relation__ structure
 */
export type ConditionalField<T, TCondition> = T extends TCondition
  ? boolean | FieldSelection<T>
  : never;

/**
 * Utility type for extracting selected fields from a type
 */
export type SelectedFields<T, TSelection> = {
  [K in keyof T as TSelection extends { [P in K]: true } ? K : never]: T[K];
};

/**
 * Utility type for making fields optional
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making fields required
 */
export type RequiredFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Helper type for recursive field selection
 * Uses __relation__ for determining recursive traversal
 */
export type RecursiveFieldSelection<T> = {
  // Regular fields (non-relations)
  [K in keyof ExtractNonRelations<T>]?: boolean;
} & {
  // Relation fields from __relation__ with recursion
  [K in keyof ExtractRelations<T>]?: ExtractRelations<T>[K] extends Array<infer U>
    ? RecursiveFieldSelection<U>
    : RecursiveFieldSelection<ExtractRelations<T>[K]>;
};

/**
 * Export helper types for external use
 */
export type { ExtractRelations, ExtractNonRelations };
