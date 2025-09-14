import type { Hidden } from "./hidden";
import type {
  ApplyTypeRefStyle,
  EnumRef,
  FieldDefinition,
  GraphqlSchema,
  InferByTypeRef,
  InputDefinition,
  InputTypeRef,
  ObjectTypeRef,
  RefMappingWithOptionalFlags,
  ScalarRef,
  TypeRefOfObjectField,
  UnionTypeRef,
  UnwrapRefList,
} from "./schema";

type Prettify<T> = { [K in keyof T]: T[K] } & {};
const _prettify = <T extends object>(obj: T) => obj as Prettify<T>;

type OperationType = "query" | "mutation" | "subscription";

export type GraphqlDocument<
  TSchema extends GraphqlSchema,
  TOperation extends OperationType,
  TData extends object,
  TVariables extends object,
> = {
  type: "document";

  operation: TOperation;

  _type: Hidden<{ data: TData; variables: TVariables }>;

  name: string;

  variables: {
    [name: string]: InputDefinition;
  };

  fields: SelectedFields<TSchema, TSchema["schema"][TOperation]>;
};

export type InlineFragment<TSchema extends GraphqlSchema, TTypename extends keyof TSchema["object"]> = {
  typename: TTypename;
  fields: SelectedFields<TSchema, TTypename>;
};

export type SelectedFields<TSchema extends GraphqlSchema, TTypename extends keyof TSchema["object"]> = {
  [alias: string]: FieldSelection<TSchema, TTypename>;
};

export type FieldSelection<TSchema extends GraphqlSchema, TTypename extends keyof TSchema["object"]> = FieldSelectionMapping<
  TSchema,
  TTypename
>[keyof TSchema["object"][TTypename]["fields"]];

export type FieldSelectionMapping<TSchema extends GraphqlSchema, TTypename extends keyof TSchema["object"]> = {
  [TFieldName in keyof TSchema["object"][TTypename]["fields"]]: {
    field: TFieldName;

    args: ArgumentAssignments<TSchema, TSchema["object"][TTypename]["fields"][TFieldName]["arguments"]>;

    directives: {
      /* TODO: implement */
    };
  } & (TypeRefOfObjectField<TSchema, TTypename, TFieldName> extends infer TRef extends ObjectTypeRef | UnionTypeRef
    ? { nested: FieldSelectionNestedTypes<TSchema, TRef> }
    : {});
};

export type FieldSelectionNestedTypes<TSchema extends GraphqlSchema, TRef extends ObjectTypeRef | UnionTypeRef> = {
  [TNestedTypename in keyof TSchema["object"] &
    (
      | (TRef extends ObjectTypeRef ? TRef["name"] : never)
      | (TRef extends UnionTypeRef ? keyof TSchema["union"][TRef["name"]]["types"] : never)
    )]?: InlineFragment<TSchema, TNestedTypename>;
};

export type VariableRef<T> = `${VariableRefInner<T>}`;
type VariableRefInner<T> = `$${string}` & { _type: Hidden<T> };

export type ArgumentAssignments<TSchema extends GraphqlSchema, TRefMapping extends { [key: string]: InputDefinition }> = {
  [K in keyof RefMappingWithOptionalFlags<TRefMapping>]: ArgumentAssignmentBody<TSchema, TRefMapping[K]>;
};

type ArgumentAssignmentBody<TSchema extends GraphqlSchema, TRef extends ScalarRef | EnumRef | InputTypeRef> =
  | VariableRef<InferByTypeRef<TSchema, TRef>>
  | (TRef extends { listStyle: "not-a-list" }
      ?
          | (TRef extends InputTypeRef ? ArgumentAssignmentBodyStruct<TSchema, TRef["name"]> : never)
          | (TRef extends EnumRef ? InferByTypeRef<TSchema, TRef> : never)
      : ArgumentAssignmentBody<TSchema, UnwrapRefList<TRef>>[]);

type ArgumentAssignmentBodyStruct<TSchema extends GraphqlSchema, TInputType extends keyof TSchema["input"]> = {
  [K in keyof RefMappingWithOptionalFlags<TSchema["input"][TInputType]["fields"]>]: ArgumentAssignmentBody<
    TSchema,
    TSchema["input"][TInputType]["fields"][K]
  >;
};

export type InferFromSelectedFields<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TSelectedFields extends SelectedFields<TSchema, TTypename>,
> = {
  [TAliasName in keyof TSelectedFields]: InferFromFieldSelection<TSchema, TTypename, TSelectedFields, TAliasName>;
};

export type InferFromFieldSelection<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TSelectedFields extends SelectedFields<TSchema, TTypename>,
  TAliasName extends keyof TSelectedFields,
> = TypeRefOfObjectField<TSchema, TTypename, TSelectedFields[TAliasName]["field"]> extends infer TRef extends FieldDefinition
  ? TSelectedFields[TAliasName] extends { nested: infer TNested }
    ? ApplyTypeRefStyle<
        TRef,
        {
          [TNestedTypename in keyof TNested & keyof TSchema["object"]]: TNested[TNestedTypename] extends {
            typename: TNestedTypename;
            fields: infer TNestedFields extends SelectedFields<TSchema, TNestedTypename>;
          }
            ? Prettify<InferFromSelectedFields<TSchema, TNestedTypename, TNestedFields>>
            : never;
        }[keyof TNested & keyof TSchema["object"]]
      >
    : InferByTypeRef<TSchema, TRef>
  : never;
