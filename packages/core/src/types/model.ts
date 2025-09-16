import type { ArgumentAssignments } from "./arguments";
import type { Fields, FieldsBuilder, InferFields } from "./fields";
import type { GraphqlSchema } from "./schema";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject, VoidIfEmptyObject } from "./utility";

export type ModelFn<TSchema extends GraphqlSchema> = <
  TTypeName extends keyof TSchema["object"],
  TFields extends Fields<TSchema, TTypeName>,
  TTransformed extends object,
  TVariables extends { [key: string]: InputDefinition } = EmptyObject,
>(
  target: TTypeName | [TTypeName, TVariables],
  builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
  transform: (selected: NoInfer<InferFields<TSchema, TTypeName, TFields>>) => TTransformed,
) => NoInfer<Model<TSchema, TTypeName, TVariables, TFields, TTransformed>>;

type Model<
  TSchema extends GraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TVariables extends { [key: string]: InputDefinition },
  TFields extends Fields<TSchema, TTypeName>,
  TTransformed extends object,
> = {
  typename: TTypeName;
  variables: TVariables;
  fragment: (variables: VoidIfEmptyObject<TVariables> | ArgumentAssignments<TSchema, TVariables>) => TFields;
  transform: (selected: InferFields<TSchema, TTypeName, TFields>) => TTransformed;
};
