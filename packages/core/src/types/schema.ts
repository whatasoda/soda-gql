import { type Hidden, hidden } from "./hidden";

type Prettify<T> = { [K in keyof T]: T[K] } & {};
const prettify = <T extends object>(obj: T) => obj as Prettify<T>;

type AbstractRef<TKind extends string> = {
  kind: TKind;
  name: string;
  style: RefStyle;
};

type RefStyle =
  | "?" // nullable, no-default
  | "?=" // nullable, with-default
  | "?[]?" // nullable, list, no-default
  | "?[]?=" // nullable, list, with-default
  | "?[]!" // nullable, list, with-default
  | "?[]!=" // nullable, list, with-default
  | "!" // non-nullable, no-default
  | "!=" // non-nullable, with-default
  | "![]?" // non-nullable, list, no-default
  | "![]?=" // non-nullable, list, with-default
  | "![]!" // non-nullable, list, with-default
  | "![]!="; // non-nullable, list, with-default

type UnwrapRefStyleList2<TStyle extends RefStyle> = {
  "?": "?";
  "?=": "?=";
  "?[]?": "?";
  "?[]?=": "?";
  "?[]!": "?";
  "?[]!=": "?";
  "!": "!";
  "!=": "!=";
  "![]?": "!";
  "![]?=": "!";
  "![]!": "!";
  "![]!=": "!";
}[TStyle];

export type ApplyTypeRefStyle<TRef extends { style: RefStyle }, TInner> = {
  "?": TInner | null | undefined;
  "?=": TInner | null | undefined;
  "?[]?": (TInner | null | undefined)[] | null | undefined;
  "?[]?=": (TInner | null | undefined)[] | null | undefined;
  "?[]!": (TInner | null | undefined)[];
  "?[]!=": (TInner | null | undefined)[];
  "!": TInner;
  "!=": TInner;
  "![]?": TInner[] | null | undefined;
  "![]?=": TInner[] | null | undefined;
  "![]!": TInner[];
  "![]!=": TInner[];
}[TRef["style"]];

type RefStyleOfOptional = { [T in RefStyle]: T extends `${string}${"?" | "="}` ? T : never }[RefStyle];

export type UnwrapRefList<TRef extends TypeRef> = TRef extends { listStyle: "not-a-list" }
  ? TRef
  : {
      kind: TRef["kind"];
      name: TRef["name"];
      style: UnwrapRefStyleList2<TRef["style"]>;
    };

export type RefMappingWithOptionalFlags<TRefMapping extends { [key: string]: { style: RefStyle } }> = {
  [K in keyof TRefMapping as TRefMapping[K] extends { style: RefStyleOfOptional } ? never : K]-?: TRefMapping[K];
} & {
  [K in keyof TRefMapping as TRefMapping[K] extends { style: RefStyleOfOptional } ? K : never]+?: TRefMapping[K];
};

export type TypeRef = ScalarRef | EnumRef | InputTypeRef | ObjectTypeRef | UnionTypeRef;

export type ScalarRef = AbstractRef<"scalar">;

export type EnumRef = AbstractRef<"enum">;

export type InputTypeRef = AbstractRef<"input">;

export type ObjectTypeRef = AbstractRef<"object">;

export type UnionTypeRef = AbstractRef<"union">;

export type InputDefinition = ScalarRef | EnumRef | InputTypeRef;

export type FieldDefinition = ScalarRef | EnumRef | ObjectTypeRef | UnionTypeRef;

export const unsafeRef = {
  scalar: <T extends string, const TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "scalar", name, style } satisfies ScalarRef & { style: TStyle }),
  enum: <T extends string, const TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "enum", name, style } satisfies EnumRef & { style: TStyle }),
  input: <T extends string, const TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "input", name, style } satisfies InputTypeRef & { style: TStyle }),
  object: <T extends string, const TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "object", name, style } satisfies ObjectTypeRef & { style: TStyle }),
  union: <T extends string, const TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "union", name, style } satisfies UnionTypeRef & { style: TStyle }),
};

export const createTypeRefFactories = <TSchema extends GraphqlSchema>(_schemas: TSchema) => ({
  scalar: <T extends keyof TSchema["scalar"] & string, TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "scalar", name, style } satisfies ScalarRef & { style: TStyle }),
  enum: <T extends keyof TSchema["enum"] & string, TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "enum", name, style } satisfies EnumRef & { style: TStyle }),
  input: <T extends keyof TSchema["input"] & string, TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "input", name, style } satisfies InputTypeRef & { style: TStyle }),
  object: <T extends keyof TSchema["object"] & string, TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "object", name, style } satisfies ObjectTypeRef & { style: TStyle }),
  union: <T extends keyof TSchema["union"] & string, TStyle extends RefStyle>(name: T, style: TStyle) =>
    prettify({ kind: "union", name, style } satisfies UnionTypeRef & { style: TStyle }),
});

const named = <TName extends string, TValue>(name: TName, value: TValue) => ({ [name]: value }) as { [K in TName]: TValue };

export type Scalar<T> = {
  _type: Hidden<T>;

  name: string;
};
export const defineScalar =
  <const TName extends string>(name: TName) =>
  <TType>() =>
    named(name, { _type: hidden(), name } satisfies Scalar<TType>);

export type Enum<T extends string> = {
  _type: Hidden<T>;

  name: string;

  values: { [_ in T]: true };
};
export const defineEnum =
  <const TName extends string>(name: TName) =>
  <const TValues extends Enum<string>["values"]>(values: TValues) =>
    named(name, { _type: hidden(), name, values } satisfies Enum<keyof TValues & string>);

export type InputType<T extends object> = {
  _type: Hidden<T>;

  name: string;

  // oneOf: boolean;

  fields: {
    [field: string]: InputDefinition;
  };
};
export const defineInputType =
  <const TName extends string>(name: TName) =>
  <TType extends object>() =>
  <TFields extends InputType<TType>["fields"]>(fields: TFields) =>
    named(name, { _type: hidden(), name, fields } satisfies InputType<TType>);

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
export const defineObjectType =
  <const TName extends string>(name: TName) =>
  <TType extends object>() =>
  <TFields extends ObjectType<TType>["fields"]>(fields: TFields) =>
    named(name, { _type: hidden(), name, fields } satisfies ObjectType<TType>);

export type UnionType<T extends object> = {
  _type: Hidden<T>;

  name: string;

  types: { [typename: string]: true };
};
export const createDefineUnionType =
  <TSchema extends GraphqlSchema["object"]>(_schemas: TSchema) =>
  <const TName extends string>(name: TName) =>
  <TTypes extends UnionType<object>["types"]>(types: TTypes & NoInfer<{ [_ in keyof TSchema & string]?: true }>) =>
    named(name, { _type: hidden(), name, types } satisfies UnionType<
      {
        [TTypename in keyof TTypes & keyof TSchema]: TSchema[TTypename] extends { _type: Hidden<infer T extends object> }
          ? T
          : never;
      }[keyof TTypes & keyof TSchema]
    >);

export type GraphqlSchema = {
  schema: {
    query: string;
    mutation: string;
    subscription: string;
  };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  scalar: { [typename: string]: Scalar<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  enum: { [typename: string]: Enum<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  input: { [typename: string]: InputType<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  object: { [typename: string]: ObjectType<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  union: { [typename: string]: UnionType<any> };
  // directives: {
  //   query: { [typename: string]: Directive<any> }
  //   mutation: { [typename: string]: true };
  //   subscription: { [typename: string]: true };
  //   parameter: { [typename: string]: true };
  // };
};

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

type InferByScalarRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["scalar"]> = TSchema["scalar"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByEnumRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["enum"]> = TSchema["enum"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByInputRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["input"]> = TSchema["input"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByObjectRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["object"]> = TSchema["object"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

type InferByUnionRef<TSchema extends GraphqlSchema, TName extends keyof TSchema["union"]> = TSchema["union"][TName] extends {
  _type: Hidden<infer T>;
}
  ? T
  : never;

export type InferArgumentType<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypename]["fields"],
  TArgumentName extends keyof TSchema["object"][TTypename]["fields"][TFieldName]["arguments"],
> = InferByTypeRef<TSchema, TSchema["object"][TTypename]["fields"][TFieldName]["arguments"][TArgumentName]>;

export type TypeRefOfObjectField<
  TSchema extends GraphqlSchema,
  TTypename extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypename]["fields"],
> = TSchema["object"][TTypename]["fields"][TFieldName]["type"];
