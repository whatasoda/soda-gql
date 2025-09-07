/**
 * Field Selection type definitions
 * Copied from spec - not imported from /specs directory
 *
 * @see docs/decisions/001-relation-field-selection.md for design rationale
 *
 * Key concepts:
 * - Relations are explicitly marked with __relation__ property
 * - Regular objects can only be selected with boolean
 * - Arrays are automatically unwrapped for field selection
 * - __relation__ can be nested at any level
 */

/**
 * Helper type to extract relation fields from __relation__ property
 */
type ExtractRelations<T> = T extends { __relation__: infer R extends object } ? R : {};

/**
 * Helper type to extract non-relation fields (excluding __relation__)
 */
type ExtractNonRelations<T> = Omit<T, "__relation__">;

/**
 * Helper type to extract __typename field from a type
 * Accepts both required and optional __typename fields
 */
type ExtractTypename<T> = T extends { __typename?: infer U extends string }
  ? NonNullable<U>
  : never;

/**
 * Helper type to unwrap array types for field selection
 * For arrays, we want to select fields of the element type, not the array itself
 */
type UnwrapArray<T> = T extends Array<infer U> ? U : T;

/**
 * Field selection for GraphQL types with deep/nested traversal support
 * Relations are explicitly defined in __relation__ property
 * For array relations, the selection applies to each element
 * Requires __typename to be defined in the type (either required or optional)
 * Always supports deep selection through relations
 */
// biome-ignore lint/suspicious/noExplicitAny: generic default for type utility
export type FieldSelection<T = any> = T extends T
  ? {
      // __typename__ field is required for GraphQL type discrimination
      // The type must define __typename (either required or optional)
      __typename__: ExtractTypename<T>;
    } & {
      // Regular fields (non-relations)
      [K in keyof ExtractNonRelations<T>]?: boolean;
    } & {
      // Relation fields from __relation__ with deep traversal
      // Arrays are unwrapped so selection applies to elements
      [K in keyof ExtractRelations<T>]?: FieldSelection<UnwrapArray<ExtractRelations<T>[K]>>;
    }
  : never;

/**
 * @deprecated Use FieldSelection instead - it now supports deep selection by default
 */
// biome-ignore lint/suspicious/noExplicitAny: generic default for type utility
export type DeepFieldSelection<T = any> = FieldSelection<T>;

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
 * Arrays are automatically unwrapped
 * Requires __typename to be defined in the type (either required or optional)
 */
// biome-ignore lint/suspicious/noExplicitAny: generic default for type utility
export type RecursiveFieldSelection<T = any> = {
  // __typename__ field for GraphQL type discrimination
  __typename__: ExtractTypename<T>;
} & {
  // Regular fields (non-relations)
  [K in keyof ExtractNonRelations<T>]?: boolean;
} & {
  // Relation fields from __relation__ with recursion
  // Arrays are unwrapped for selection
  [K in keyof ExtractRelations<T>]?: RecursiveFieldSelection<UnwrapArray<ExtractRelations<T>[K]>>;
};

/**
 * Export helper types for external use
 */
export type { ExtractRelations, ExtractNonRelations, UnwrapArray };
