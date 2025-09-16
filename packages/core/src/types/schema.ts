import {
  type ApplyTypeFormat,
  type EnumRef,
  type FieldDefinition,
  type InferrableTypeRef,
  type InputDefinition,
  type InputTypeRef,
  type ScalarRef,
  type TypenameRef,
  unsafeType,
} from "./type-ref";
import { type Hidden, hidden } from "./utility";

const named = <TName extends string, TValue>(name: TName, value: TValue) => ({ [name]: value }) as { [K in TName]: TValue };

export type Scalar<T> = {
  _type: Hidden<T>;

  name: string;
};

export type Enum<T extends string> = {
  _type: Hidden<T>;

  name: string;

  values: { [_ in T]: true };
};

export type InputType = {
  name: string;

  // TODO: implement
  // oneOf: boolean;

  fields: {
    [field: string]: InputDefinition;
  };
};

export type ObjectType = {
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

export type UnionType = {
  name: string;

  types: { [typename: string]: true };
};

export const define = <const TName extends string>(name: TName) => ({
  scalar: <TType>() =>
    named(name, {
      _type: hidden(),
      name,
    } satisfies Scalar<TType>),

  enum: <const TValues extends Enum<string>["values"]>(values: TValues) =>
    named(name, {
      _type: hidden(),
      name,
      values,
    } satisfies Enum<keyof TValues & string>),

  input: <TFields extends InputType["fields"]>(fields: TFields) =>
    named(name, {
      name,
      fields,
    } satisfies InputType),

  object: <TFields extends ObjectType["fields"]>(fields: TFields) =>
    named(name, {
      name,
      fields: {
        __typename: { arguments: {}, type: unsafeType.typename(name, "!") },
        ...fields,
      },
    } satisfies ObjectType),

  union: <TTypes extends UnionType["types"]>(types: TTypes) =>
    named(name, {
      name,
      types,
    } satisfies UnionType),
});

export type OperationType = keyof GraphqlSchema["schema"];

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
  input: { [typename: string]: InputType };
  object: { [typename: string]: ObjectType };
  union: { [typename: string]: UnionType };
  // directives: {
  //   query: { [typename: string]: Directive<any> }
  //   mutation: { [typename: string]: true };
  //   subscription: { [typename: string]: true };
  //   parameter: { [typename: string]: true };
  // };
};

export type InferByTypeRef<TSchema extends GraphqlSchema, TRef extends InferrableTypeRef> = {
  typename: TRef extends TypenameRef ? InferTypenameByRef<TSchema, TRef> : never;
  scalar: TRef extends ScalarRef ? InferScalarByRef<TSchema, TRef> : never;
  enum: TRef extends EnumRef ? InferEnumByRef<TSchema, TRef> : never;
}[TRef["kind"]];

type InferTypenameByRef<TSchema extends GraphqlSchema, TRef extends TypenameRef> = TRef["name"] extends keyof TSchema["object"]
  ? ApplyTypeFormat<TRef, TRef["name"]>
  : never;

type InferScalarByRef<TSchema extends GraphqlSchema, TRef extends ScalarRef> = ApplyTypeFormat<
  TRef,
  ReturnType<TSchema["scalar"][TRef["name"]]["_type"]>
>;

type InferEnumByRef<TSchema extends GraphqlSchema, TRef extends EnumRef> = ApplyTypeFormat<
  TRef,
  ReturnType<TSchema["enum"][TRef["name"]]["_type"]>
>;

export type InferInputDefinitionType<TSchema extends GraphqlSchema, TRef extends InputDefinition> =
  | (TRef extends ScalarRef ? InferByTypeRef<TSchema, TRef> : never)
  | (TRef extends EnumRef ? InferByTypeRef<TSchema, TRef> : never)
  | (TRef extends InputTypeRef
      ? TSchema["input"][TRef["name"]]["fields"] extends infer TFields extends { [key: string]: InputDefinition }
        ? { [K in keyof TFields]: InferInputDefinitionType<TSchema, TFields[K]> }
        : never
      : never);

export type InferArgumentTypeByFieldName<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
  TArgumentName extends keyof TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"],
> = InferInputDefinitionType<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"][TArgumentName]>;

export type PickTypeRefByFieldName<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName]["type"];
