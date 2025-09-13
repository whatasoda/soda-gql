import type { Hidden } from "./hidden";
import type {
  BuildType,
  EnumRef,
  GraphqlSchema,
  InputDefinition,
  InputTypeRef,
  ObjectTypeRef,
  RefMappingWithOptionalFlags,
  ScalarRef,
  UnionTypeRef,
  UnwrapRefList,
} from "./schema";

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

export type SelectedFields<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
> = {
  [alias: string]: FieldSelection<TSchema, TTypename>;
};

export type FieldSelection<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
> = FieldSelectionMapping<TSchema, TTypename>[keyof TSchema["objects"][TTypename]["fields"]];

export type FieldSelectionMapping<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
> = {
  [TField in keyof TSchema["objects"][TTypename]["fields"]]: {
    field: TField;

    args: ArgumentAssignments<
      TSchema,
      TSchema["objects"][TTypename]["fields"][TField]["arguments"]
    >;

    directives: {
      /* TODO: implement */
    };
  } & FieldSelectionNestedTypes<TSchema, TSchema["objects"][TTypename]["fields"][TField]["type"]>;
};

type FieldSelectionNestedTypes<
  TSchema extends GraphqlSchema,
  TRef extends ScalarRef | EnumRef | ObjectTypeRef | UnionTypeRef,
> = {
  scalar: {};
  enum: {};
  object: TRef extends ObjectTypeRef
    ? {
        selection: Array<{
          typename: TRef["name"];
          fields: SelectedFields<TSchema, TRef["name"]>;
        }>;
      }
    : { selection: [] };
  union: TRef extends UnionTypeRef
    ? {
        selection: Array<
          {
            [TNestedTypename in keyof TSchema["unions"][TRef["name"]]["types"]]: TNestedTypename extends keyof TSchema["objects"]
              ? {
                  typename: TNestedTypename;
                  fields: SelectedFields<TSchema, TNestedTypename>;
                }
              : never;
          }[keyof TSchema["unions"][TRef["name"]]["types"]]
        >;
      }
    : { selection: [] };
}[TRef["kind"]];

export type VariableRef<T> = {
  _type: Hidden<T>;

  name: string;
};

export type ArgumentAssignments<
  TSchema extends GraphqlSchema,
  TRefMapping extends { [key: string]: InputDefinition },
> = {
  [K in keyof RefMappingWithOptionalFlags<TRefMapping>]: ArgumentAssignmentBody<
    TSchema,
    TRefMapping[K]
  >;
};

type ArgumentAssignmentBody<
  TSchema extends GraphqlSchema,
  TRef extends ScalarRef | EnumRef | InputTypeRef,
> =
  | { kind: "ref"; ref: VariableRef<BuildType<TSchema, TRef>> }
  | (TRef extends { listStyle: "not-a-list" }
      ? TRef extends InputTypeRef
        ? ArgumentAssignmentBodyStruct<TSchema, TRef["name"]>
        : never
      : ArgumentAssignmentBody<TSchema, UnwrapRefList<TRef>>[]);

type ArgumentAssignmentBodyStruct<
  TSchema extends GraphqlSchema,
  TInputType extends keyof TSchema["inputs"],
> = {
  kind: "struct";
  struct: {
    [K in keyof RefMappingWithOptionalFlags<
      TSchema["inputs"][TInputType]["fields"]
    >]: ArgumentAssignmentBody<TSchema, TSchema["inputs"][TInputType]["fields"][K]>;
  };
};

export type BuildTypeFromSelectedFields<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TSelected extends SelectedFields<TSchema, TTypename>,
> = {
  [K in keyof TSelected]: BuildTypeFromFieldSelection<TSchema, TTypename, TSelected[K]>;
};

type BuildTypeFromFieldSelection<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TFieldSelection extends FieldSelection<TSchema, TTypename>,
> = TFieldSelection extends {
  selection: (infer TSelection extends {
    typename: string;
    fields: SelectedFields<TSchema, string>;
  })[];
}
  ? {
      [TNestedTypename in TSelection["typename"]]: BuildTypeFromSelectedFields<
        TSchema,
        TNestedTypename,
        Extract<TSelection, { typename: TNestedTypename }>["fields"]
      >;
    }[TSelection["typename"]]
  : BuildType<TSchema, TSchema["objects"][TTypename]["fields"][TFieldSelection["field"]]["type"]>;
