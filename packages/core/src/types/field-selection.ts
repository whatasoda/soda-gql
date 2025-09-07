/**
 * Field Selection type definitions
 * Copied from spec - not imported from /specs directory
 *
 * @see docs/decisions/004-typename-based-relations.md for design rationale
 *
 * Key concepts:
 * - Relations are identified by presence of __typename in the target type
 * - Regular objects (no __typename) can only be selected with boolean
 * - Arrays are automatically unwrapped for field selection
 * - Relations can be nested at any level
 */

/**
 * Helper type to unwrap array types for field selection
 * For arrays, we want to select fields of the element type, not the array itself
 */
type NormalizeField<T> = NonNullable<T> extends ReadonlyArray<infer U> ? U : NonNullable<T>;

/**
 * Helper type to check if a type has __typename (making it a relation)
 */
type HasTypename<T> = T extends { __typename?: string } ? true : false;

/**
 * Helper type to extract fields that are relations (have __typename)
 */
type ExtractRelationFields<T> = {
  [K in keyof T as HasTypename<NormalizeField<T[K]>> extends true ? K : never]: T[K];
};

/**
 * Helper type to extract fields that are not relations (no __typename)
 */
type ExtractNonRelationFields<T> = {
  [K in keyof T as HasTypename<NormalizeField<T[K]>> extends false ? K : never]: T[K];
};

/**
 * Helper type to extract __typename field from a type
 * Accepts both required and optional __typename fields
 */
type ExtractTypename<T> = T extends { __typename?: infer U extends string }
  ? NonNullable<U>
  : never;

/**
 * Field selection for GraphQL types with deep/nested traversal support
 * Relations are identified by presence of __typename in the target type
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
      // Non-relation fields (no __typename in target type)
      [K in keyof ExtractNonRelationFields<T>]?: boolean;
    } & {
      // Relation fields (have __typename in target type) with deep traversal
      // Arrays are unwrapped so selection applies to elements
      [K in keyof ExtractRelationFields<T>]?: FieldSelection<NormalizeField<T[K]>>;
    }
  : never;

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
 * Uses __typename presence for determining recursive traversal
 * Arrays are automatically unwrapped
 * Requires __typename to be defined in the type (either required or optional)
 */
// biome-ignore lint/suspicious/noExplicitAny: generic default for type utility
export type RecursiveFieldSelection<T = any> = {
  // __typename__ field for GraphQL type discrimination
  __typename__: ExtractTypename<T>;
} & {
  // Non-relation fields (no __typename)
  [K in keyof ExtractNonRelationFields<T>]?: boolean;
} & {
  // Relation fields (have __typename) with recursion
  // Arrays are unwrapped for selection
  [K in keyof ExtractRelationFields<T>]?: RecursiveFieldSelection<NormalizeField<T[K]>>;
};

/**
 * Export helper types for external use
 * @deprecated ExtractRelations and ExtractNonRelations - use ExtractRelationFields and ExtractNonRelationFields
 */
export type {
  ExtractRelationFields as ExtractRelations,
  ExtractNonRelationFields as ExtractNonRelations,
  NormalizeField as UnwrapArray,
};
