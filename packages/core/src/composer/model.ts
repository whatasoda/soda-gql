import { type FieldsBuilder, type MergeFields, Model, mergeFields } from "../types/element";
import type { AnyFields, InferFields } from "../types/fragment";
import type { SchemaByKey, SodaGqlSchemaRegistry } from "../types/registry";
import type { InputTypeSpecifiers, OperationType } from "../types/schema";
import { mapValues } from "../utils/map-values";
import { createFieldFactories } from "./fields-builder";
import { createVarAssignments, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createGqlModelComposers = <TSchemaKey extends keyof SodaGqlSchemaRegistry>(
  schema: NoInfer<SchemaByKey<TSchemaKey>>,
) => {
  type ModelBuilder<TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string> = <
    TFieldEntries extends AnyFields[],
    TNormalized extends object,
    TVarDefinitions extends InputTypeSpecifiers[] = [{}],
  >(
    options: {
      variables?: TVarDefinitions;
    },
    builder: FieldsBuilder<TSchemaKey, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
    normalize: (raw: NoInfer<InferFields<TSchemaKey, MergeFields<TFieldEntries>>>) => TNormalized,
  ) => ReturnType<
    typeof Model.create<TSchemaKey, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>, TNormalized>
  >;

  const createModelComposer = <TTypeName extends keyof SchemaByKey<TSchemaKey>["object"] & string>(
    typename: TTypeName,
  ): ModelBuilder<TTypeName> => {
    return <
      TFieldEntries extends AnyFields[],
      TNormalized extends object,
      TVarDefinitions extends InputTypeSpecifiers[] = [{}],
    >(
      options: {
        variables?: TVarDefinitions;
      },
      builder: FieldsBuilder<TSchemaKey, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
      normalize: (raw: NoInfer<InferFields<TSchemaKey, MergeFields<TFieldEntries>>>) => TNormalized,
    ) =>
      Model.create<TSchemaKey, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>, TNormalized>(() => {
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
    readonly [TTypeName in keyof SchemaByKey<TSchemaKey>["object"]]: TTypeName extends string
      ? ModelBuilder<TTypeName>
      : never;
  };
  type ModelBuilders = Omit<
    ModelBuildersAll,
    SchemaByKey<TSchemaKey>["operations"][OperationType] & keyof ModelBuildersAll
  >;

  return mapValues(schema.object, (_, typename) => createModelComposer(typename)) as ModelBuilders;
};
