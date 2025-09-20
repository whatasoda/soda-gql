import {
  type ApplyTypeFormat,
  type EnumRef,
  type FieldDefinition,
  type InferrableTypeRef,
  type InputDefinition,
  type InputTypeRef,
  type ScalarRef,
  type TypenameRef,
  type UnionTypeRef,
  unsafeRef,
} from "./type-ref";
import { type Hidden, hidden } from "./utility";

export type OperationType = keyof AnyGraphqlSchema["schema"];
export type AnyTypeName = PropertyKey;
export type AnyFieldName = PropertyKey;

export type AnyGraphqlSchema = {
  schema: {
    query: string;
    mutation: string;
    subscription: string;
  };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  scalar: { [name: string]: ScalarDef<any> };
  // biome-ignore lint/suspicious/noExplicitAny: abstract types
  enum: { [name: string]: EnumDef<any> };
  input: { [name: string]: InputDef };
  object: { [name: string]: ObjectDef };
  union: { [name: string]: UnionDef };
  // directives: {
  //   query: { [typename: string]: Directive<any> }
  //   mutation: { [typename: string]: true };
  //   subscription: { [typename: string]: true };
  //   parameter: { [typename: string]: true };
  // };
};

export type ScalarDef<T> = {
  _type: Hidden<T>;

  name: string;
};

export type EnumDef<T extends string> = {
  _type: Hidden<T>;

  name: string;

  values: { [_ in T]: true };
};

export type InputDef = {
  name: string;

  // TODO: implement
  // oneOf: boolean;

  fields: {
    [field: string]: InputDefinition;
  };
};

export type ObjectDef = {
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

export type UnionDef = {
  name: string;

  types: { [typename: string]: true };
};

export type InferByTypeRef<TSchema extends AnyGraphqlSchema, TRef extends InferrableTypeRef> = {
  typename: TRef extends TypenameRef
    ? TRef["name"] extends keyof TSchema["object"]
      ? ApplyTypeFormat<TRef, TRef["name"]>
      : never
    : never;
  scalar: TRef extends ScalarRef ? ApplyTypeFormat<TRef, ReturnType<TSchema["scalar"][TRef["name"]]["_type"]>> : never;
  enum: TRef extends EnumRef ? ApplyTypeFormat<TRef, ReturnType<TSchema["enum"][TRef["name"]]["_type"]>> : never;
}[TRef["kind"]];

export type InferInputDefinitionType<TSchema extends AnyGraphqlSchema, TRef extends InputDefinition> =
  | (TRef extends ScalarRef ? InferByTypeRef<TSchema, TRef> : never)
  | (TRef extends EnumRef ? InferByTypeRef<TSchema, TRef> : never)
  | (TRef extends InputTypeRef
      ? TSchema["input"][TRef["name"]]["fields"] extends infer TFields extends { [key: string]: InputDefinition }
        ? { [K in keyof TFields]: InferInputDefinitionType<TSchema, TFields[K]> }
        : never
      : never);

export type PickTypeRefByFieldName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName]["type"];

export type ObjectFieldRecord<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"]> = {
  [TFieldName in keyof TSchema["object"][TTypeName]["fields"]]: TSchema["object"][TTypeName]["fields"][TFieldName];
};

export type UnionTypeRecord<TSchema extends AnyGraphqlSchema, TRef extends UnionTypeRef> = {
  [TTypeName in Extract<keyof TSchema["object"], keyof TSchema["union"][TRef["name"]]["types"]>]: TSchema["object"][TTypeName];
};

const named = <TName extends string, TValue>(name: TName, value: TValue) => ({ [name]: value }) as { [K in TName]: TValue };

export const define = <const TName extends string>(name: TName) => ({
  scalar: <TType>() =>
    named(name, {
      _type: hidden(),
      name,
    } satisfies ScalarDef<TType>),

  enum: <const TValues extends EnumDef<string>["values"]>(values: TValues) =>
    named(name, {
      _type: hidden(),
      name,
      values,
    } satisfies EnumDef<keyof TValues & string>),

  input: <TFields extends InputDef["fields"]>(fields: TFields) =>
    named(name, {
      name,
      fields,
    } satisfies InputDef),

  object: <TFields extends ObjectDef["fields"]>(fields: TFields) =>
    named(name, {
      name,
      fields: {
        __typename: { arguments: {}, type: unsafeRef.typename(name, "!") },
        ...fields,
      },
    } satisfies ObjectDef),

  union: <TTypes extends UnionDef["types"]>(types: TTypes) =>
    named(name, {
      name,
      types,
    } satisfies UnionDef),
});

export const createHelpers = <TSchema extends AnyGraphqlSchema>(schema: TSchema) => ({
  fieldArg: <
    const TTypeName extends keyof TSchema["object"] & string,
    const TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
    const TArgName extends keyof TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"] & string,
  >(
    typeName: TTypeName,
    fieldName: TFieldName,
    argName: TArgName,
  ) => {
    const argTypeRef = schema.object[typeName]?.fields[fieldName]?.arguments[argName];

    if (!argTypeRef) {
      throw new Error(`Argument ${argName} not found in field ${fieldName} of type ${typeName}`);
    }

    return argTypeRef as TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"][TArgName];
  },
});
