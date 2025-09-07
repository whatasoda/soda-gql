/**
 * Field Selection type definitions
 * Copied from spec - not imported from /specs directory
 */

/**
 * Basic field selection for GraphQL types with proper type inference
 */
export type FieldSelection<T = any> = {
  [K in keyof T]?: T[K] extends object ? boolean | FieldSelection<T[K]> : boolean;
};

/**
 * Deep field selection that allows nested object traversal
 */
export type DeepFieldSelection<T = any> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Array<infer U>
      ? DeepFieldSelection<U>
      : DeepFieldSelection<T[K]>
    : boolean;
};

/**
 * Conditional field selection based on type
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
 */
export type RecursiveFieldSelection<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? RecursiveFieldSelection<U>
    : T[K] extends object
      ? RecursiveFieldSelection<T[K]>
      : boolean;
};
