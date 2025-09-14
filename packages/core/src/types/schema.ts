import type { Hidden } from "./hidden";

type AbstractRef<TKind extends string> = {
  kind: TKind;
  name: string;
} & RefStyle;

type RefStyle = {
  hasDefault?: boolean;
  selfStyle: "non-null" | "nullable";
  listStyle: "not-a-list" | "non-null-list" | "nullable-list";
};

type NonNullRefStyle =
  | {
      selfStyle: "non-null";
      listStyle: "not-a-list";
      hasDefault?: false;
    }
  | {
      listStyle: "non-null-list";
      hasDefault?: false;
    };

export type UnwrapRefList<TRef extends TypeRef> = TRef extends { listStyle: "not-a-list" }
  ? TRef
  : {
      kind: TRef["kind"];
      name: TRef["name"];
      hasDefault: TRef["hasDefault"];
      selfStyle: TRef["selfStyle"];
      listStyle: "not-a-list";
    };

export type RefMappingWithOptionalFlags<TRefMapping extends { [key: string]: RefStyle }> = {
  [K in keyof TRefMapping as TRefMapping[K] extends NonNullRefStyle ? K : never]-?: TRefMapping[K];
} & {
  [K in keyof TRefMapping as TRefMapping[K] extends NonNullRefStyle ? never : K]+?: TRefMapping[K];
};

export type TypeRef = ScalarRef | EnumRef | InputTypeRef | ObjectTypeRef | UnionTypeRef;

export type ScalarRef = AbstractRef<"scalar">;

export type EnumRef = AbstractRef<"enum">;

export type InputTypeRef = AbstractRef<"input">;

export type ObjectTypeRef = AbstractRef<"object">;

export type UnionTypeRef = AbstractRef<"union">;

export type InputDefinition = ScalarRef | EnumRef | InputTypeRef;

export type FieldDefinition = ScalarRef | EnumRef | ObjectTypeRef | UnionTypeRef;

export type Scalar<T> = {
  _type: Hidden<T>;

  name: string;
};

export type Enum<T> = {
  _type: Hidden<T>;

  name: string;

  values: { [value: string]: true };
};

export type InputType<T extends object> = {
  _type: Hidden<T>;

  name: string;

  // oneOf: boolean;

  fields: {
    [field: string]: InputDefinition;
  };
};

export type ObjectType<T extends object> = {
  _type: Hidden<T>;

  name: string;

  fields: {
    [field: string]: {
      arguments: {
        [name: string]: InputDefinition;
      };
      type: FieldDefinition;
    };
  };
};

export type UnionType<T extends object> = {
  _type: Hidden<T>;

  name: string;

  types: { [typename: string]: true };
};

export type GraphqlSchema = {
  schema: {
    query: string;
    mutation: string;
    subscription: string;
  };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  scalars: { [typename: string]: Scalar<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  enums: { [typename: string]: Enum<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  inputs: { [typename: string]: InputType<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  unions: { [typename: string]: UnionType<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  objects: { [typename: string]: ObjectType<any> };
  // directives: {
  //   query: { [typename: string]: Directive<any> }
  //   mutation: { [typename: string]: true };
  //   subscription: { [typename: string]: true };
  //   parameter: { [typename: string]: true };
  // };
};

type Nullish = null | undefined;

export type ApplyTypeRefStyle<TRef extends RefStyle, TInner> = {
  "non-null-list": Array<
    {
      nullable: TInner | Nullish;
      "non-null": TInner;
    }[TRef["selfStyle"]]
  >;
  "nullable-list":
    | Array<
        {
          nullable: TInner | Nullish;
          "non-null": TInner;
        }[TRef["selfStyle"]]
      >
    | Nullish;
  "not-a-list": {
    nullable: TInner | Nullish;
    "non-null": TInner;
  }[TRef["selfStyle"]];
}[TRef["listStyle"]];

export type InferByTypeRef<TSchema extends GraphqlSchema, TRef extends TypeRef> = ApplyTypeRefStyle<
  TRef,
  InferByTypeRefInner<TSchema, TRef>
>;

type InferByTypeRefInner<TSchema extends GraphqlSchema, TRef extends TypeRef> = {
  scalar: TRef extends { kind: "scalar" } ? InferByScalarRef<TSchema, TRef["name"]> : never;
  enum: TRef extends { kind: "enum" } ? InferByEnumRef<TSchema, TRef["name"]> : never;
  input: TRef extends { kind: "input" } ? InferByInputRef<TSchema, TRef["name"]> : never;
  object: TRef extends { kind: "object" } ? InferByObjectRef<TSchema, TRef["name"]> : never;
  union: TRef extends { kind: "union" } ? InferByUnionRef<TSchema, TRef["name"]> : never;
}[TRef["kind"]];

type InferByScalarRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["scalars"]> = TSchema["scalars"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByEnumRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["enums"]> = TSchema["enums"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByInputRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["inputs"]> = TSchema["inputs"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByObjectRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["objects"]> = TSchema["objects"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByUnionRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["unions"]> = TSchema["unions"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

export type InferArgumentType<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TFieldName extends keyof TSchema["objects"][TTypename]["fields"],
  TArgumentName extends keyof TSchema["objects"][TTypename]["fields"][TFieldName]["arguments"],
> = InferByTypeRef<TSchema, TSchema["objects"][TTypename]["fields"][TFieldName]["arguments"][TArgumentName]>;

export type TypeRefOfObjectField<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["objects"],
  TFieldName extends keyof TSchema["objects"][TTypename]["fields"],
> = TSchema["objects"][TTypename]["fields"][TFieldName]["type"];
