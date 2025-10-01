import type { AnyFields, InferFields } from "../types/fragment";
import { type FieldsBuilder, Model } from "../types/operation";
import type { AnyGraphqlSchema, InputTypeRefs } from "../types/schema";
import { createFieldFactories } from "./fields-builder";
import { createVarAssignments } from "./input";

export const createModelFactory = <TSchema extends AnyGraphqlSchema>(schema: NoInfer<TSchema>) => {
  return <
    TTypeName extends keyof TSchema["object"] & string,
    TFields extends AnyFields,
    TNormalized extends object,
    TVarDefinitions extends InputTypeRefs = {},
  >(
    options: {
      typename: TTypeName;
      variables?: TVarDefinitions;
    },
    builder: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>,
    normalize: (raw: NoInfer<InferFields<TSchema, TFields>>) => TNormalized,
  ) => {
    return Model.create<TSchema, TTypeName, TVarDefinitions, TFields, TNormalized>(() => {
      const varDefinitions = (options.variables ?? {}) as TVarDefinitions;
      const fieldFactories = createFieldFactories(schema, options.typename);

      return {
        typename: options.typename,
        fragment: (variables) =>
          builder({
            _: fieldFactories,
            f: fieldFactories,
            $: createVarAssignments<TSchema, TVarDefinitions>(varDefinitions, variables),
          }),
        normalize,
      };
    });
  };
};
