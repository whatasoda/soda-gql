/** Canonical field selection types used by models and slices. */
import type { AnyDirectiveAttachments } from "./directives";
import type { AnyFieldName, AnyGraphqlSchema, AnyTypeName, InferByTypeRef, PickTypeRefByFieldName } from "./schema";
import type { ApplyTypeFormat, FieldDefinition, InferrableTypeRef, ObjectTypeRef, UnionTypeRef } from "./type-ref";
import type { Prettify } from "./utility";
import type { AnyVariableAssignments, VariableReferencesByFieldName } from "./variables";

/**
 * Canonical representation of the field selections we collect during model and
 * slice definition. Each alias maps to a typed field reference that still
 * remembers its parent type, arguments, directives, and nested selections.
 */
export type AnyFieldReference = {
  parent: AnyTypeName;
  field: AnyFieldName;
  type: FieldDefinition;
  args: AnyVariableAssignments;
  directives: AnyDirectiveAttachments;
  object: AnyNestedObject | null;
  union: AnyNestedUnion | null;
};

/** Nested selection produced when resolving an object field. */
export type AnyNestedObject = { [alias: string]: AnyFieldReference };
/** Nested selection produced when resolving a union field. */
export type AnyNestedUnion = { [typeName: string]: { [alias: string]: AnyFieldReference } | undefined };

/** Map of alias → field reference used by builders and inference. */
export type AnyFields = {
  [alias: string]: AnyFieldReference;
};

/** Strongly typed field reference produced for concrete schema members. */
export type AbstractFieldReference<
  TTypeName extends AnyTypeName,
  TFieldName extends AnyFieldName,
  TRef extends FieldDefinition,
  TArgs extends AnyVariableAssignments,
  TDirectives extends AnyDirectiveAttachments,
  TExtras extends { object: AnyNestedObject } | { union: AnyNestedUnion } | { _?: never },
> = {
  parent: TTypeName;
  field: TFieldName;
  type: TRef;
  args: TArgs;
  directives: TDirectives;
  object: TExtras extends { object: infer TObject } ? TObject : null;
  union: TExtras extends { union: infer TUnion } ? TUnion : null;
};

/** Convenience alias to obtain a typed field reference from the schema. */
export type FieldReferenceOf<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
> = PickTypeRefByFieldName<TSchema, TTypeName, TFieldName> extends infer TRef extends FieldDefinition
  ? AbstractFieldReference<
      TTypeName,
      TFieldName,
      TRef,
      VariableReferencesByFieldName<TSchema, TTypeName, TFieldName>,
      AnyDirectiveAttachments,
      | (TRef extends ObjectTypeRef ? { object: AnyNestedObject } : never)
      | (TRef extends UnionTypeRef ? { union: AnyNestedUnion } : never)
    >
  : never;

/** Resolve the data shape produced by a set of field references. */
export type InferFields<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = Prettify<{
  [TAliasName in keyof TFields]: InferField<TSchema, TFields[TAliasName]>;
}>;

/** Resolve the data shape for a single field reference, including nested objects/unions. */
export type InferField<TSchema extends AnyGraphqlSchema, TReference extends AnyFieldReference> =
  | (TReference extends {
      type: infer TRef extends ObjectTypeRef;
      object: infer TNested extends AnyNestedObject;
    }
      ? ApplyTypeFormat<TRef, InferFields<TSchema, TNested>>
      : never)
  | (TReference extends {
      type: infer TRef extends UnionTypeRef;
      union: infer TNested extends AnyNestedUnion;
    }
      ? ApplyTypeFormat<
          TRef,
          {
            [TTypename in keyof TNested]: undefined extends TNested[TTypename]
              ? never
              : InferFields<TSchema, NonNullable<TNested[TTypename]>>;
          }[keyof TNested]
        >
      : never)
  | (TReference extends {
      type: infer TRef extends InferrableTypeRef;
    }
      ? InferByTypeRef<TSchema, TRef>
      : never);
