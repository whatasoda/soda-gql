import type { VariableReferencesByDefinition } from "./variables";
import type { AnyFields, InferFields } from "./fields";
import type { FieldsBuilder } from "./fields-builder";
import type { AnyGraphqlSchema } from "./schema";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject, VoidIfEmptyObject } from "./utility";

export type ModelFn<TSchema extends AnyGraphqlSchema> = <
  TTypeName extends keyof TSchema["object"],
  TFields extends AnyFields,
  TTransformed extends object,
  TVariables extends { [key: string]: InputDefinition } = EmptyObject,
>(
  target: TTypeName | [TTypeName, TVariables],
  builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
  transform: (selected: NoInfer<InferFields<TSchema, TFields>>) => TTransformed,
) => NoInfer<Model<TSchema, TTypeName, TVariables, TFields, TTransformed>>;

type Model<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"],
  TVariables extends { [key: string]: InputDefinition },
  TFields extends AnyFields,
  TTransformed extends object,
> = {
  typename: TTypeName;
  variables: TVariables;
  fragment: (variables: VoidIfEmptyObject<TVariables> | VariableReferencesByDefinition<TSchema, TVariables>) => TFields;
  transform: (selected: InferFields<TSchema, TFields>) => TTransformed;
};
