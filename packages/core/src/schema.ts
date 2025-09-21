import type { EnumRef, InputTypeRef, ObjectTypeRef, ScalarRef, TypeFormat, TypenameRef, UnionTypeRef } from "./types";
import type { AnyGraphqlSchema, EnumDef, InputDef, ObjectDef, OperationTypeNames, ScalarDef, UnionDef } from "./types/schema";
import { hidden, prettify, wrapValueByKey } from "./types/utility";

/** Fluent helper to declare schema components in a type-safe way. */

export const unsafeRef = {
  typename: <T extends string, const TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "typename", name, format } satisfies TypenameRef & { format: TFormat }),
  scalar: <T extends string, const TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "scalar", name, format } satisfies ScalarRef & { format: TFormat }),
  enum: <T extends string, const TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "enum", name, format } satisfies EnumRef & { format: TFormat }),
  input: <T extends string, const TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "input", name, format } satisfies InputTypeRef & { format: TFormat }),
  object: <T extends string, const TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "object", name, format } satisfies ObjectTypeRef & { format: TFormat }),
  union: <T extends string, const TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "union", name, format } satisfies UnionTypeRef & { format: TFormat }),
};

export const define = <const TName extends string>(name: TName) => ({
  scalar: <TType>() =>
    wrapValueByKey(name, {
      _type: hidden(),
      name,
    } satisfies ScalarDef<TType>),

  enum: <const TValues extends EnumDef<string>["values"]>(values: TValues) =>
    wrapValueByKey(name, {
      _type: hidden(),
      name,
      values,
    } satisfies EnumDef<keyof TValues & string>),

  input: <TFields extends InputDef["fields"]>(fields: TFields) =>
    wrapValueByKey(name, {
      name,
      fields,
    } satisfies InputDef),

  object: <TFields extends ObjectDef["fields"]>(fields: TFields) =>
    wrapValueByKey(name, {
      name,
      fields: {
        __typename: { arguments: {}, type: unsafeRef.typename(name, "!") },
        ...fields,
      },
    } satisfies ObjectDef),

  union: <TTypes extends UnionDef["types"]>(types: TTypes) =>
    wrapValueByKey(name, {
      name,
      types,
    } satisfies UnionDef),
});

export const defineOperationTypeNames = <const TOperationTypeNames extends OperationTypeNames>(
  operationTypeNames: TOperationTypeNames,
) => operationTypeNames;

/** Accessor utilities for looking up argument definitions from the schema. */
export const createGqlHelpers = <TSchema extends AnyGraphqlSchema>(schema: TSchema) => ({
  scalar: <T extends keyof TSchema["scalar"] & string, TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "scalar", name, format } satisfies ScalarRef & { format: TFormat }),
  enum: <T extends keyof TSchema["enum"] & string, TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "enum", name, format } satisfies EnumRef & { format: TFormat }),
  input: <T extends keyof TSchema["input"] & string, TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "input", name, format } satisfies InputTypeRef & { format: TFormat }),
  object: <T extends keyof TSchema["object"] & string, TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "object", name, format } satisfies ObjectTypeRef & { format: TFormat }),
  union: <T extends keyof TSchema["union"] & string, TFormat extends TypeFormat>(name: T, format: TFormat) =>
    prettify({ kind: "union", name, format } satisfies UnionTypeRef & { format: TFormat }),

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
