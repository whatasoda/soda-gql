import { type FieldsBuilder, type MergeFields, Model, mergeFields } from "../types/element";
import type { AnyFields, InferFields } from "../types/fragment";
import type { AnyGraphqlSchema, InputTypeSpecifiers, OperationType } from "../types/schema";
import { mapValues } from "../utils/map-values";
import { createFieldFactories } from "./fields-builder";
import { createVarAssignments, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createGqlModelComposers = <TSchema extends AnyGraphqlSchema>(schema: NoInfer<TSchema>) => {
  type ModelBuilder<TTypeName extends keyof TSchema["object"] & string> = <
    TFieldEntries extends AnyFields[],
    TNormalized extends object,
    TVarDefinitions extends InputTypeSpecifiers[] = [{}],
  >(
    options: {
      variables?: TVarDefinitions;
    },
    builder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
    normalize: (raw: NoInfer<InferFields<TSchema, MergeFields<TFieldEntries>>>) => TNormalized,
  ) => ReturnType<
    typeof Model.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>, TNormalized>
  >;

  const createModelComposer = <TTypeName extends keyof TSchema["object"] & string>(
    typename: TTypeName,
  ): ModelBuilder<TTypeName> => {
    return <TFieldEntries extends AnyFields[], TNormalized extends object, TVarDefinitions extends InputTypeSpecifiers[] = [{}]>(
      options: {
        variables?: TVarDefinitions;
      },
      builder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
      normalize: (raw: NoInfer<InferFields<TSchema, MergeFields<TFieldEntries>>>) => TNormalized,
    ) =>
      Model.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>, TNormalized>(() => {
        const varDefinitions = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        return {
          typename,
          fragment: (variables) => {
            const f = createFieldFactories(schema, typename);
            const $ = createVarAssignments(varDefinitions, variables);
            return mergeFields(builder({ f, $ }));
          },
          normalize,
        };
      });
  };

  type ModelBuildersAll = {
    readonly [TTypeName in keyof TSchema["object"]]: TTypeName extends string ? ModelBuilder<TTypeName> : never;
  };
  type ModelBuilders = Omit<ModelBuildersAll, TSchema["operations"][OperationType] & keyof ModelBuildersAll>;

  return mapValues(schema.object, (_, typename) => createModelComposer(typename)) as ModelBuilders;
};
