/** Utilities for computing type-safe field path selectors and projections. */
import type { AnyFields, AnyNestedObject, InferField } from "./fields";
import type { AnyGraphqlSchema } from "./schema";

/**
 * Computes strongly typed "$.foo.bar" style selectors for a set of fields so
 * slice result transforms can reference response paths safely.
 */
export type FieldPaths<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = FieldPathsInner<TSchema, TFields, "$"> &
  string;

/** Recursive helper used to build path strings for nested selections. */
type FieldPathsInner<TSchema extends AnyGraphqlSchema, TFields extends AnyFields, TCurr extends string> = {
  [TAliasName in keyof TFields & string]:
    | `${TCurr}.${TAliasName}`
    | (TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? FieldPathsInner<TSchema, TNested, `${TCurr}.${TAliasName}`>
        : never);
}[keyof TFields & string];

/** Resolve the TypeScript type located at a given field path. */
export type InferByFieldPath<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPath extends string,
> = string extends keyof TFields
  ? // biome-ignore lint/suspicious/noExplicitAny: abstract type
    any
  : TPath extends "$"
    ? never
    : InferByFieldPathInner<TSchema, TFields, TPath, "$">;

/** Internal helper that walks a field tree while matching a path literal. */
type InferByFieldPathInner<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPath extends string,
  TCurr extends string,
> = {
  [TAliasName in keyof TFields & string]: `${TCurr}.${TAliasName}` extends TPath
    ? InferField<TSchema, TFields[TAliasName]>
    : TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
      ? InferByFieldPathInner<TSchema, TNested, TPath, `${TCurr}.${TAliasName}`>
      : never;
}[keyof TFields & string];
