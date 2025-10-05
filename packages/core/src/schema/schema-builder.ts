import type {
  AnyConstDirectiveAttachments,
  EnumDef,
  InputDef,
  ObjectDef,
  OperationRoots,
  ScalarDef,
  UnionDef,
} from "../types/schema";
import { type Hidden, hidden } from "../utils/hidden";
import { wrapByKey } from "../utils/wrap-by-key";
import { unsafeOutputRef } from "./type-ref-builder";

export const defineScalar = <const TName extends string, TInput, TOutput, TDirectives extends AnyConstDirectiveAttachments>(
  name: TName,
  definition: (tool: { type: typeof hidden }) => {
    input: Hidden<TInput>;
    output: Hidden<TOutput>;
    directives: TDirectives;
  },
) =>
  wrapByKey(name, {
    _type: hidden() as Hidden<{ input: TInput; output: TOutput }>,
    name,
    directives: definition({ type: hidden }).directives,
  } satisfies ScalarDef<{ input: TInput; output: TOutput }>);

export const define = <const TName extends string>(name: TName) => ({
  enum: <const TValues extends EnumDef<string>["values"], TDirectives extends AnyConstDirectiveAttachments>(
    values: TValues,
    directives: TDirectives,
  ) =>
    ({
      _type: hidden(),
      name,
      values,
      directives,
    }) satisfies EnumDef<keyof TValues & string>,

  input: <TFields extends InputDef["fields"], TDirectives extends AnyConstDirectiveAttachments>(
    fields: TFields,
    directives: TDirectives,
  ) =>
    ({
      name,
      fields,
      directives,
    }) satisfies InputDef,

  object: <TFields extends ObjectDef["fields"], TDirectives extends AnyConstDirectiveAttachments>(
    fields: TFields,
    directives: TDirectives,
  ) =>
    ({
      name,
      fields: {
        __typename: unsafeOutputRef.typename(`${name}:!`, {}),
        ...fields,
      },
      directives,
    }) satisfies ObjectDef,

  union: <TTypes extends UnionDef["types"], TDirectives extends AnyConstDirectiveAttachments>(
    types: TTypes,
    directives: TDirectives,
  ) =>
    ({
      name,
      types,
      directives,
    }) satisfies UnionDef,
});

export const defineOperationRoots = <const TOperationRoots extends OperationRoots>(operationRoots: TOperationRoots) =>
  operationRoots;
