import type { AnyDirectiveAttachments } from "./directives";
import type { AnyFieldName, AnyGraphqlSchema, AnyTypeName, InferByTypeRef, PickTypeRefByFieldName } from "./schema";
import type { ApplyTypeFormat, FieldDefinition, InferrableTypeRef, ObjectTypeRef, UnionTypeRef } from "./type-ref";
import type { Prettify } from "./utility";
import type { AnyVariableAssignments, VariableReferencesByFieldName } from "./variables";

export type AnyFieldReference = {
  parent: AnyTypeName;
  field: AnyFieldName;
  type: FieldDefinition;
  args: AnyVariableAssignments;
  directives: AnyDirectiveAttachments;
  object: AnyNestedObject | null;
  union: AnyNestedUnion | null;
};

export type AnyNestedObject = { [alias: string]: AnyFieldReference };
type AnyNestedUnion = { [typeName: string]: { [alias: string]: AnyFieldReference } };

export type AnyFields = {
  [alias: string]: AnyFieldReference;
};

export type AbstractFieldReference<
  TTypeName extends AnyTypeName,
  TFieldName extends AnyFieldName,
  TRef extends FieldDefinition,
  TArgs extends AnyVariableAssignments,
  TDirectives extends AnyDirectiveAttachments,
  TExtras extends { object: AnyNestedObject } | { union: AnyNestedUnion },
> = {
  parent: TTypeName;
  field: TFieldName;
  type: TRef;
  args: TArgs;
  directives: TDirectives;
  object: TExtras extends { object: infer TObject } ? TObject : null;
  union: TExtras extends { union: infer TUnion } ? TUnion : null;
};

export type FieldReferenceOf<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
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

export type InferFields<TSchema extends AnyGraphqlSchema, TFields extends AnyFields> = Prettify<{
  [TAliasName in keyof TFields]: InferField<TSchema, TFields[TAliasName]>;
}>;

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
      ? ApplyTypeFormat<TRef, { [TTypename in keyof TNested]: InferFields<TSchema, TNested[TTypename]> }[keyof TNested]>
      : never)
  | (TReference extends {
      type: infer TRef extends InferrableTypeRef;
    }
      ? InferByTypeRef<TSchema, TRef>
      : never);
