import type {
  AnyFields,
  AnyGraphqlSchema,
  EmptyObject,
  FieldsBuilder,
  InferFields,
  InputDefinition,
  Model,
  ModelFn,
} from "../types";
import { createFieldFactories } from "./fields-builder";
import { createVariableAssignments } from "./variables";

export const createModelFactory = <TSchema extends AnyGraphqlSchema>(schema: TSchema) => {
  const modelFn: ModelFn<TSchema> = <
    TTypeName extends keyof TSchema["object"] & string,
    TFields extends AnyFields,
    TTransformed extends object,
    TVariables extends { [key: string]: InputDefinition } = EmptyObject,
  >(
    target: TTypeName | [TTypeName, TVariables],
    builder: FieldsBuilder<TSchema, TTypeName, TVariables, TFields>,
    transform: (selected: NoInfer<InferFields<TSchema, TFields>>) => TTransformed,
  ) => {
    const [typename, variablesDefinition] = Array.isArray(target)
      ? [target[0] as TTypeName, target[1] ?? ({} as TVariables)]
      : [target as TTypeName, {} as TVariables];

    const fieldFactories = createFieldFactories(schema, typename);

    const model: Model<TSchema, TTypeName, TVariables, TFields, TTransformed> = {
      typename,
      variables: variablesDefinition,
      fragment: (assignments) =>
        builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $: createVariableAssignments<TSchema, TVariables>(variablesDefinition, assignments),
        }),
      transform,
    };

    return model;
  };

  return modelFn;
};
