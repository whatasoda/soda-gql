import type { AbstractFieldReference, AnyFieldReference, AnyFields, AnyNestedObject, FieldReferenceOf } from "./fields";
import type { AnyGraphqlSchema, ObjectFieldRecord, UnionTypeRecord } from "./schema";
import type { EnumRef, InputDefinition, ObjectTypeRef, ScalarRef, TypenameRef, UnionTypeRef } from "./type-ref";
import type { VoidIfEmptyObject } from "./utility";
import type { VariableReferencesByDefinition } from "./variables";

export type FieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TVariables extends { [key: string]: InputDefinition },
  TFields extends AnyFields,
> = (tools: {
  _: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  f: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  fields: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  $: NoInfer<VariableReferencesByDefinition<TSchema, TVariables>>;
}) => TFields;

type NestedFieldsBuilder<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends AnyFields,
> = (tools: {
  _: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  f: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  fields: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
}) => TFields;

type FieldReferenceFactories<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  [TFieldName in keyof ObjectFieldRecord<TSchema, TTypeName>]: FieldReferenceFactory<
    TSchema,
    FieldReferenceOf<TSchema, TTypeName, TFieldName>
  >;
};

type FieldReferenceFactory<TSchema extends AnyGraphqlSchema, TReference extends AnyFieldReference> =
  | (TReference extends { type: ObjectTypeRef }
      ? <TNested extends AnyNestedObject>(
          fieldArguments: FieldReferenceFactoryFieldArguments<TReference>,
          object: NestedFieldsBuilder<TSchema, TReference["type"]["name"], TNested>,
        ) => {
          [_ in TReference["field"]]: AbstractFieldReference<
            TReference["parent"],
            TReference["field"],
            TReference["type"],
            TReference["args"],
            TReference["directives"],
            { object: TNested }
          >;
        }
      : never)
  | (TReference extends { type: UnionTypeRef }
      ? <
          TNested extends {
            [TTypename in keyof UnionTypeRecord<TSchema, TReference["type"]>]: NestedFieldsBuilder<TSchema, TTypename, AnyFields>;
          },
        >(
          fieldArguments: FieldReferenceFactoryFieldArguments<TReference>,
          union: TNested,
        ) => {
          [_ in TReference["field"]]: AbstractFieldReference<
            TReference["parent"],
            TReference["field"],
            TReference["type"],
            TReference["args"],
            TReference["directives"],
            {
              union: {
                [K in keyof TNested]: ReturnType<NonNullable<TNested[K]>>;
              };
            }
          >;
        }
      : never)
  | (TReference extends { type: TypenameRef | ScalarRef | EnumRef }
      ? (fieldArguments: FieldReferenceFactoryFieldArguments<TReference>) => {
          [_ in TReference["field"]]: AbstractFieldReference<
            TReference["parent"],
            TReference["field"],
            TReference["type"],
            TReference["args"],
            TReference["directives"],
            never
          >;
        }
      : never);

type FieldReferenceFactoryFieldArguments<TFieldSelectionTemplate extends AnyFieldReference> =
  | TFieldSelectionTemplate["args"]
  | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
  | [args: TFieldSelectionTemplate["args"] | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>, directives: {}];
