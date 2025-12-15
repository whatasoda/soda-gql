import type {
  EnumDefinition,
  InputDefinition,
  ObjectDefinition,
  OperationRoots,
  ScalarDefinition,
  UnionDefinition,
} from "../types/schema";
import { withTypeMeta } from "../utils/type-meta";
import { wrapByKey } from "../utils/wrap-by-key";
import { unsafeOutputType } from "./type-specifier-builder";

export const defineScalar = <const TName extends string, TInput, TOutput>(name: NoInfer<TName>) =>
  wrapByKey(
    name,
    withTypeMeta({ name }) satisfies ScalarDefinition<{
      name: TName;
      input: TInput;
      output: TOutput;
    }>,
  );

export const define = <const TName extends string>(name: TName) => ({
  enum: <const TValues extends EnumDefinition<{ name: TName; values: string }>["values"]>(values: TValues) =>
    withTypeMeta({ name, values }) satisfies EnumDefinition<{
      name: TName;
      values: Extract<keyof TValues, string>;
    }>,

  input: <TFields extends InputDefinition["fields"]>(fields: TFields) =>
    ({
      name,
      fields,
    }) satisfies InputDefinition,

  object: <TFields extends ObjectDefinition["fields"]>(fields: TFields) =>
    ({
      name,
      fields: {
        __typename: unsafeOutputType.typename(`${name}:!`, {}),
        ...fields,
      },
    }) satisfies ObjectDefinition,

  union: <TTypes extends UnionDefinition["types"]>(types: TTypes) =>
    ({
      name,
      types,
    }) satisfies UnionDefinition,
});

export const defineOperationRoots = <const TOperationRoots extends OperationRoots>(operationRoots: TOperationRoots) =>
  operationRoots;
