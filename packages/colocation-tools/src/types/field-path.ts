/** Utilities for computing type-safe field path selectors. */

import type { AnyFieldsExtended, AnyNestedObjectExtended } from "@soda-gql/core";

export type AnyFieldPath = string;

/** Maximum recursion depth to prevent infinite type instantiation. */
type MaxDepth = [unknown, unknown, unknown, unknown, unknown]; // 5 levels

/** Decrement depth counter for recursion limiting. */
type DecrementDepth<D extends readonly unknown[]> = D extends readonly [unknown, ...infer Rest] ? Rest : [];

/**
 * Computes strongly typed "$.foo.bar" style selectors for a set of fields so
 * slice result transforms can reference response paths safely.
 *
 * Note: TSchema is not needed - only uses TFields.object for nesting.
 * Supports both factory-style fields and shorthand syntax (true).
 */
export type AvailableFieldPathOf<TFields extends AnyFieldsExtended> = AvailableFieldPathsInner<TFields, "$", MaxDepth>;

/** Recursive helper used to build path strings for nested selections. */
type AvailableFieldPathsInner<
  TFields extends AnyFieldsExtended,
  TCurr extends AnyFieldPath,
  TDepth extends readonly unknown[],
> = TDepth extends readonly []
  ? never
  : {
      readonly [TAliasName in keyof TFields]-?: TAliasName extends string
        ?
            | `${TCurr}.${TAliasName}`
            | (TFields[TAliasName] extends { object: infer TNested extends AnyNestedObjectExtended }
                ? AvailableFieldPathsInner<TNested, `${TCurr}.${TAliasName}`, DecrementDepth<TDepth>>
                : never)
        : never;
    }[keyof TFields];
