import {
  type AnyFields,
  type AnyGraphqlSchema,
  type EmptyObject,
  type FieldsBuilder,
  type InferFields,
  type InputTypeRefs,
  type Model,
  type ModelFn,
  pseudoTypeAnnotation,
} from "../types";
import { createFieldFactories } from "./fields-builder";
import { createVariableAssignments } from "./input";

export const createModelFactory = <TSchema extends AnyGraphqlSchema>(schema: TSchema) => {
  const modelFn: ModelFn<TSchema> = <
    TTypeName extends keyof TSchema["object"] & string,
    TFields extends AnyFields,
    TTransformed extends object,
    TVariableDefinitions extends InputTypeRefs = EmptyObject,
  >(
    target: TTypeName | [TTypeName, TVariableDefinitions],
    builder: FieldsBuilder<TSchema, TTypeName, TVariableDefinitions, TFields>,
    transform: (raw: NoInfer<InferFields<TSchema, TFields>>) => TTransformed,
  ) => {
    const [typename, variablesDefinition] = Array.isArray(target)
      ? [target[0] as TTypeName, target[1] ?? ({} as TVariableDefinitions)]
      : [target as TTypeName, {} as TVariableDefinitions];

    const fieldFactories = createFieldFactories(schema, typename);

    const model: Model<TSchema, TTypeName, TVariableDefinitions, TFields, TTransformed> = {
      _input: pseudoTypeAnnotation(),
      _output: pseudoTypeAnnotation(),
      typename,
      fragment: (assignments) =>
        builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $: createVariableAssignments<TSchema, TVariableDefinitions>(variablesDefinition, assignments),
        }),
      transform,
    };

    return model;
  };

  return modelFn;
};
