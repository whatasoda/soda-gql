import type { AnyFields, AnyNestedObject, InferField, InferFields } from "./fields";
import type { AnyGraphqlSchema } from "./schema";

export type FieldPaths<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = (
  | "$"
  | FieldPathsInner<TSchema, TFields, "$">
) &
  string;

type FieldPathsInner<TSchema extends AnyGraphqlSchema, TFields extends AnyFields, TCurr extends string> = {
  [TAliasName in keyof TFields & string]:
    | `${TCurr}.${TAliasName}`
    | (TFields[TAliasName] extends { object: infer TNested extends AnyNestedObject }
        ? FieldPathsInner<TSchema, TNested, `${TCurr}.${TAliasName}`>
        : never);
}[keyof TFields & string];

export type InferByFieldPath<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPath extends string,
> = TPath extends "$" ? InferFields<TSchema, TFields> : InferByFieldPathInner<TSchema, TFields, TPath, "$">;

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
