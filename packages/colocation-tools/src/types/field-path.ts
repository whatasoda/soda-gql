/** Utilities for computing type-safe field path selectors. */

import type { AnyFields, AnyNestedObject } from "@soda-gql/core";

export type AnyFieldPath = string;

/**
 * Computes strongly typed "$.foo.bar" style selectors for a set of fields so
 * slice result transforms can reference response paths safely.
 *
 * Note: TSchema is not needed - only uses TFields.object for nesting.
 */
export type AvailableFieldPathOf<TFields extends AnyFields> = AvailableFieldPathsInner<TFields, "$">;

/** Recursive helper used to build path strings for nested selections. */
type AvailableFieldPathsInner<TFields extends AnyFields, TCurr extends AnyFieldPath> = {
  readonly [TAliasName in keyof TFields & string]:
    | `${TCurr}.${TAliasName}`
    | (TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? AvailableFieldPathsInner<TNested, `${TCurr}.${TAliasName}`>
        : never);
}[keyof TFields & string];
