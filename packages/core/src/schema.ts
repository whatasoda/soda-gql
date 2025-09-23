import { createInputTypeRefFactory, unsafeOutputRef } from "./type-ref";
import type { AnyConstDirectiveAttachments, Hidden, OperationTypeNames } from "./types";
import type { AnyGraphqlSchema, EnumDef, InputDef, ObjectDef, ScalarDef, UnionDef } from "./types/schema";
import { hidden, wrapValueByKey } from "./types/utility";

export const type = <T>() => hidden<T>();

export const define = <const TName extends string>(name: TName) => ({
  scalar: <TType extends { input: unknown; output: unknown }, TDirectives extends AnyConstDirectiveAttachments>(
    _type: Hidden<TType>,
    directives: TDirectives,
  ) =>
    wrapValueByKey(name, {
      _type,
      name,
      directives,
    } satisfies ScalarDef<TType & { input: unknown; output: unknown }>),

  enum: <const TValues extends EnumDef<string>["values"], TDirectives extends AnyConstDirectiveAttachments>(
    values: TValues,
    directives: TDirectives,
  ) =>
    wrapValueByKey(name, {
      _type: hidden(),
      name,
      values,
      directives,
    } satisfies EnumDef<keyof TValues & string>),

  input: <TFields extends InputDef["fields"], TDirectives extends AnyConstDirectiveAttachments>(
    fields: TFields,
    directives: TDirectives,
  ) =>
    wrapValueByKey(name, {
      name,
      fields,
      directives,
    } satisfies InputDef),

  object: <TFields extends ObjectDef["fields"], TDirectives extends AnyConstDirectiveAttachments>(
    fields: TFields,
    directives: TDirectives,
  ) =>
    wrapValueByKey(name, {
      name,
      fields: {
        __typename: unsafeOutputRef.typename([name, "!"], {}, {}),
        ...fields,
      },
      directives,
    } satisfies ObjectDef),

  union: <TTypes extends UnionDef["types"], TDirectives extends AnyConstDirectiveAttachments>(
    types: TTypes,
    directives: TDirectives,
  ) =>
    wrapValueByKey(name, {
      name,
      types,
      directives,
    } satisfies UnionDef),
});

export const defineOperationTypeNames = <const TOperationTypeNames extends OperationTypeNames>(
  operationTypeNames: TOperationTypeNames,
) => operationTypeNames;

/** Accessor utilities for looking up argument definitions from the schema. */
export const createGqlHelpers = <TSchema extends AnyGraphqlSchema>(schema: TSchema) => ({
  scalar: createInputTypeRefFactory<TSchema, "scalar">("scalar"),
  enum: createInputTypeRefFactory<TSchema, "enum">("enum"),
  input: createInputTypeRefFactory<TSchema, "input">("input"),

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
