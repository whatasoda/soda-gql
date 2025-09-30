import type {
  AnyConstDirectiveAttachments,
  EnumDef,
  InputDef,
  ObjectDef,
  OperationRoots,
  ScalarDef,
  UnionDef,
} from "../types/schema";
import { type PseudoTypeAnnotation, pseudoTypeAnnotation, wrapValueByKey } from "../types/shared/utility";
import { unsafeOutputRef } from "./type-ref-builder";

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
        __typename: unsafeOutputRef.typename(`${name}:!`, {}),
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
