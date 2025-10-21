/** Utilities for computing type-safe field path selectors and projections. */

import type { AnyGraphqlSchema } from "../schema";
import type { AnyFields, AnyNestedObject, InferField } from "./field-selection";

export type AnyFieldPath = string;

/**
 * Computes strongly typed "$.foo.bar" style selectors for a set of fields so
 * slice result transforms can reference response paths safely.
 */
export type AvailableFieldPathOf<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = AvailableFieldPathsInner<
  TSchema,
  TFields,
  "$"
>;

/** Recursive helper used to build path strings for nested selections. */
type AvailableFieldPathsInner<TSchema extends AnyGraphqlSchema, TFields extends AnyFields, TCurr extends AnyFieldPath> = {
  readonly [TAliasName in keyof TFields & string]:
    | `${TCurr}.${TAliasName}`
    | (TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? AvailableFieldPathsInner<TSchema, TNested, `${TCurr}.${TAliasName}`>
        : never);
}[keyof TFields & string];

/** Resolve the TypeScript type located at a given field path. */
export type InferByFieldPath<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPath extends AnyFieldPath,
> = string extends keyof TFields ? any : TPath extends "$" ? never : InferByFieldPathInner<TSchema, TFields, TPath, "$">;

/** Internal helper that walks a field tree while matching a path literal. */
type InferByFieldPathInner<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPathTarget extends AnyFieldPath,
  TPathCurrent extends AnyFieldPath,
> = {
  readonly [TAliasName in keyof TFields]: TAliasName extends string
    ? `${TPathCurrent}.${TAliasName}` extends TPathTarget
      ? InferField<TSchema, TFields[TAliasName]>
      : TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? InferByFieldPathInner<TSchema, TNested, TPathTarget, `${TPathCurrent}.${TAliasName}`>
        : never
    : never;
}[keyof TFields];
