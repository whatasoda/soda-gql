import type {
  AnyConstDirectiveAttachments,
  EnumDefinition,
  InputDefinition,
  ObjectDefinition,
  OperationRoots,
  ScalarDefinition,
  UnionDefinition,
} from "../types/schema";
import { type Hidden, hidden } from "../utils/hidden";
import { wrapByKey } from "../utils/wrap-by-key";
import { unsafeOutputType } from "./type-specifier-builder";

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
  } satisfies ScalarDefinition<{ input: TInput; output: TOutput }>);

export const define = <const TName extends string>(name: TName) => ({
  enum: <const TValues extends EnumDefinition<string>["values"], TDirectives extends AnyConstDirectiveAttachments>(
    values: TValues,
    directives: TDirectives,
  ) =>
    ({
      _type: hidden(),
      name,
      values,
      directives,
    }) satisfies EnumDefinition<keyof TValues & string>,

  input: <TFields extends InputDefinition["fields"], TDirectives extends AnyConstDirectiveAttachments>(
    fields: TFields,
    directives: TDirectives,
  ) =>
    ({
      name,
      fields,
      directives,
    }) satisfies InputDefinition,

  object: <TFields extends ObjectDefinition["fields"], TDirectives extends AnyConstDirectiveAttachments>(
    fields: TFields,
    directives: TDirectives,
  ) =>
    ({
      name,
      fields: {
        __typename: unsafeOutputType.typename(`${name}:!`, {}),
        ...fields,
      },
      directives,
    }) satisfies ObjectDefinition,

  union: <TTypes extends UnionDefinition["types"], TDirectives extends AnyConstDirectiveAttachments>(
    types: TTypes,
    directives: TDirectives,
  ) =>
    ({
      name,
      types,
      directives,
    }) satisfies UnionDefinition,
});

export const defineOperationRoots = <const TOperationRoots extends OperationRoots>(operationRoots: TOperationRoots) =>
  operationRoots;
