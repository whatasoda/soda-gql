import type { ArgumentAssignments } from "./arguments";
import type { GraphqlSchema, InferByTypeRef, PickTypeRefByFieldName } from "./schema";
import type {
  ApplyTypeFormat,
  EnumRef,
  FieldDefinition,
  InferrableTypeRef,
  InputDefinition,
  ObjectTypeRef,
  ScalarRef,
  TypenameRef,
  UnionTypeRef,
} from "./type-ref";
import type { Prettify, VoidIfEmptyObject } from "./utility";

export type Fields<TSchema extends GraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  [alias: string]: AvailableFieldReference<TSchema, TTypeName>;
};

export type AvailableFieldReference<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
> = AvailableFieldReferences<TSchema, TTypeName>[keyof TSchema["object"][TTypeName]["fields"]];

export type AvailableFieldReferences<TSchema extends GraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  [TFieldName in keyof TSchema["object"][TTypeName]["fields"]]: FieldReference<TSchema, TTypeName, TFieldName>;
};

type FieldReference<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = PickTypeRefByFieldName<TSchema, TTypeName, TFieldName> extends infer TRef extends FieldDefinition
  ? {
      field: TFieldName;
      type: TRef;
      args: ArgumentAssignments<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"]>;
      directives: {
        /* TODO: implement */
      };
      object: TRef extends ObjectTypeRef ? NestedObject<TSchema, TRef> : null;
      union: TRef extends UnionTypeRef ? NestedUnion<TSchema, TRef> : null;
    }
  : never;

type NestedObject<TSchema extends GraphqlSchema, TRef extends ObjectTypeRef> = Fields<TSchema, TRef["name"]>;

type NestedUnion<TSchema extends GraphqlSchema, TRef extends UnionTypeRef> = {
  [TTypeName in Extract<keyof TSchema["object"], keyof TSchema["union"][TRef["name"]]["types"]>]?: Fields<TSchema, TTypeName>;
};

export type InferFields<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
> = Prettify<{
  [TAliasName in keyof TFields & string]: InferFieldsItem<TSchema, TTypeName, TFields, TAliasName>;
}>;

type InferFieldsItem<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
  TAliasName extends keyof TFields & string,
> =
  | (TFields[TAliasName] extends {
      type: infer TRef extends ObjectTypeRef;
      object: infer TNested extends NestedObject<TSchema, Extract<TFields[TAliasName]["type"], ObjectTypeRef>>;
    }
      ? ApplyTypeFormat<TRef, InferFields<TSchema, TRef["name"], TNested>>
      : never)
  | (TFields[TAliasName] extends {
      type: infer TRef extends UnionTypeRef;
      union: infer TNested extends NestedUnion<TSchema, Extract<TFields[TAliasName]["type"], UnionTypeRef>>;
    }
      ? ApplyTypeFormat<
          TRef,
          {
            [TNestedTypename in keyof TNested]: TNestedTypename extends keyof TSchema["object"]
              ? TNested[TNestedTypename] extends Fields<TSchema, TNestedTypename>
                ? InferFields<TSchema, TNestedTypename, TNested[TNestedTypename]>
                : never
              : never;
          }[keyof TNested]
        >
      : never)
  | (TFields[TAliasName] extends {
      type: infer TRef extends InferrableTypeRef;
    }
      ? InferByTypeRef<TSchema, TRef>
      : never);

export type FieldPaths<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
> = (FieldPathsInner<TSchema, TTypeName, TFields, "$"> | "$") & string;

type FieldPathsInner<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
  TCurr extends string,
> = {
  [TAliasName in keyof TFields & string]:
    | `${TCurr}.${TAliasName}`
    | (TFields[TAliasName] extends {
        type: infer TRef extends ObjectTypeRef;
        object: NestedObject<TSchema, Extract<TFields[TAliasName]["type"], ObjectTypeRef>>;
      }
        ? FieldPathsInner<TSchema, TRef["name"], TFields[TAliasName]["object"], `${TCurr}.${TAliasName}`>
        : never);
}[keyof TFields & string];

export type InferByFieldPath<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
  TPath extends string,
> = InferByFieldPathInner<TSchema, TTypeName, TFields, TPath, "$">;

type InferByFieldPathInner<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
  TPath extends string,
  TCurr extends string,
> = TPath extends "$"
  ? InferFields<TSchema, TTypeName, TFields>
  : {
      [TAliasName in keyof TFields & string]: `${TCurr}.${TAliasName}` extends TPath
        ? InferFieldsItem<TSchema, TTypeName, TFields, TAliasName>
        : TFields[TAliasName] extends {
              type: infer TRef extends ObjectTypeRef;
              object: NestedObject<TSchema, Extract<TFields[TAliasName]["type"], ObjectTypeRef>>;
            }
          ? InferByFieldPathInner<TSchema, TRef["name"], TFields[TAliasName]["object"], TPath, `${TCurr}.${TAliasName}`>
          : never;
    }[keyof TFields & string];

export type FieldsBuilder<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TVariables extends { [key: string]: InputDefinition },
  TFields extends Fields<TSchema, TTypeName>,
> = (tools: {
  _: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  f: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  fields: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  $: NoInfer<ArgumentAssignments<TSchema, TVariables>>;
}) => TFields;

type InlineFieldsBuilder<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
> = (tools: {
  _: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  f: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
  fields: NoInfer<FieldReferenceFactories<TSchema, TTypeName>>;
}) => TFields;

type FieldReferenceFactories<TSchema extends GraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  [TField in keyof AvailableFieldReferences<TSchema, TTypeName>]: FieldReferenceFactory<
    TSchema,
    TTypeName,
    TField,
    FieldReference<TSchema, TTypeName, TField>
  >;
};

type FieldReferenceFactory<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TField extends keyof AvailableFieldReferences<TSchema, TTypeName>,
  TReference extends FieldReference<TSchema, TTypeName, TField>,
> =
  | (TReference extends { type: ObjectTypeRef }
      ? <TNestedSelection extends NestedObject<TSchema, TReference["type"]>>(
          fieldArguments: FieldReferenceFactoryFieldArguments<TSchema, TTypeName, TField, TReference>,
          object: InlineFieldsBuilder<TSchema, TReference["type"]["name"], TNestedSelection>,
        ) => {
          [_ in TReference["field"]]: {
            field: TReference["field"];
            type: TReference["type"];
            args: TReference["args"];
            directives: TReference["directives"];
            object: TNestedSelection;
            union: null;
          };
        }
      : never)
  | (TReference extends { type: UnionTypeRef }
      ? <
          TNestedSelection extends {
            [TNestedTypename in keyof NestedUnion<TSchema, TReference["type"]>]: InlineFieldsBuilder<
              TSchema,
              TNestedTypename,
              Fields<TSchema, TNestedTypename>
            >;
          },
        >(
          fieldArguments: FieldReferenceFactoryFieldArguments<TSchema, TTypeName, TField, TReference>,
          union: TNestedSelection,
        ) => {
          [_ in TReference["field"]]: {
            field: TReference["field"];
            type: TReference["type"];
            args: TReference["args"];
            directives: TReference["directives"];
            object: null;
            union: {
              [K in keyof TNestedSelection]: ReturnType<NonNullable<TNestedSelection[K]>>;
            };
          };
        }
      : never)
  | (TReference extends { type: TypenameRef | ScalarRef | EnumRef }
      ? (fieldArguments: FieldReferenceFactoryFieldArguments<TSchema, TTypeName, TField, TReference>) => {
          [_ in TReference["field"]]: {
            field: TReference["field"];
            type: TReference["type"];
            args: TReference["args"];
            directives: TReference["directives"];
            object: null;
            union: null;
          };
        }
      : never);

type FieldReferenceFactoryFieldArguments<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TField extends keyof AvailableFieldReferences<TSchema, TTypeName>,
  TFieldSelectionTemplate extends FieldReference<TSchema, TTypeName, TField> = FieldReference<TSchema, TTypeName, TField>,
> =
  | TFieldSelectionTemplate["args"]
  | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>
  | [args: TFieldSelectionTemplate["args"] | VoidIfEmptyObject<TFieldSelectionTemplate["args"]>, directives: {}];
