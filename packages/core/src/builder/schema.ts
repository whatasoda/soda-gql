import type {
  AnyConstDirectiveAttachments,
  AnyGraphqlSchema,
  EnumDef,
  InputDef,
  ObjectDef,
  OperationRoots,
  PseudoTypeAnnotation,
  ScalarDef,
  UnionDef,
} from "../types";
import { pseudoTypeAnnotation, wrapValueByKey } from "../types";
import { createInputTypeRefFactory, unsafeOutputRef } from "./type-ref";

export const defineScalar = <const TName extends string, TInput, TOutput, TDirectives extends AnyConstDirectiveAttachments>(
  name: TName,
  definition: (tool: { type: typeof pseudoTypeAnnotation }) => {
    input: PseudoTypeAnnotation<TInput>;
    output: PseudoTypeAnnotation<TOutput>;
    directives: TDirectives;
  },
) =>
  wrapValueByKey(name, {
    _type: pseudoTypeAnnotation() as PseudoTypeAnnotation<{ input: TInput; output: TOutput }>,
    name,
    directives: definition({ type: pseudoTypeAnnotation }).directives,
  } satisfies ScalarDef<{ input: TInput; output: TOutput }>);

export const define = <const TName extends string>(name: TName) => ({
  enum: <const TValues extends EnumDef<string>["values"], TDirectives extends AnyConstDirectiveAttachments>(
    values: TValues,
    directives: TDirectives,
  ) =>
    wrapValueByKey(name, {
      _type: pseudoTypeAnnotation(),
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

export const defineOperationRoots = <const TOperationRoots extends OperationRoots>(operationRoots: TOperationRoots) =>
  operationRoots;

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
