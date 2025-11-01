/** Utilities for computing type-safe field path selectors and projections. */

import type { SodaGqlSchemaRegistry } from "../registry";
import type { AnyFields, AnyNestedObject, InferField } from "./field-selection";

export type AnyFieldPath = string;

/**
 * Computes strongly typed "$.foo.bar" style selectors for a set of fields so
 * slice result transforms can reference response paths safely.
 */
export type AvailableFieldPathOf<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TFields extends AnyFields,
> = AvailableFieldPathsInner<TSchemaKey, TFields, "$">;

/** Recursive helper used to build path strings for nested selections. */
type AvailableFieldPathsInner<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TFields extends AnyFields,
  TCurr extends AnyFieldPath,
> = {
  readonly [TAliasName in keyof TFields & string]:
    | `${TCurr}.${TAliasName}`
    | (TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? AvailableFieldPathsInner<TSchemaKey, TNested, `${TCurr}.${TAliasName}`>
        : never);
}[keyof TFields & string];

/** Resolve the TypeScript type located at a given field path. */
export type InferByFieldPath<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TFields extends AnyFields,
  TPath extends AnyFieldPath,
> = string extends keyof TFields
  ? any
  : TPath extends "$"
    ? never
    : InferByFieldPathInner<TSchemaKey, TFields, TPath, "$">;

/** Internal helper that walks a field tree while matching a path literal. */
type InferByFieldPathInner<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TFields extends AnyFields,
  TPathTarget extends AnyFieldPath,
  TPathCurrent extends AnyFieldPath,
> = {
  readonly [TAliasName in keyof TFields]: TAliasName extends string
    ? `${TPathCurrent}.${TAliasName}` extends TPathTarget
      ? InferField<TSchemaKey, TFields[TAliasName]>
      : TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? InferByFieldPathInner<TSchemaKey, TNested, TPathTarget, `${TPathCurrent}.${TAliasName}`>
        : never
    : never;
}[keyof TFields];
