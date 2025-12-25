import { type FieldsBuilder, type MergeFields, Model, mergeFields } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type { ModelMetadataBuilder, OperationMetadata } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";
import { getCurrentFieldPath } from "./field-path-context";
import { createFieldFactories } from "./fields-builder";
import { createVarAssignments, type createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";
import { recordModelUsage } from "./model-usage-context";

export const createGqlModelComposers = <TSchema extends AnyGraphqlSchema>(schema: NoInfer<TSchema>) => {
  type ModelBuilder<TTypeName extends keyof TSchema["object"] & string> = <
    TFieldEntries extends AnyFields[],
    TVarDefinitions extends InputTypeSpecifiers[] = [{}],
  >(
    options: {
      variables?: TVarDefinitions;
      metadata?: ModelMetadataBuilder<
        ReturnType<typeof createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>>,
        OperationMetadata
      >;
    },
    builder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
  ) => ReturnType<typeof Model.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>>>;

  const createModelComposer = <TTypeName extends keyof TSchema["object"] & string>(
    typename: TTypeName,
  ): ModelBuilder<TTypeName> => {
    return <TFieldEntries extends AnyFields[], TVarDefinitions extends InputTypeSpecifiers[] = [{}]>(
      options: {
        variables?: TVarDefinitions;
        metadata?: ModelMetadataBuilder<
          ReturnType<typeof createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>>,
          OperationMetadata
        >;
      },
      builder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
    ) =>
      // biome-ignore lint/suspicious/noExplicitAny: Type variance issue with ModelMetadataBuilder generics - safe cast
      Model.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>>(((): any => {
        const varDefinitions = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
        return {
          typename,
          embed: (variables: any) => {
            const f = createFieldFactories(schema, typename);
            const $ = createVarAssignments<TSchema, MergeVarDefinitions<TVarDefinitions>>(varDefinitions, variables);

            // Record model usage for metadata aggregation (after $ is created)
            // biome-ignore lint/suspicious/noExplicitAny: Type variance issue with metadata builder generics
            recordModelUsage({
              metadataBuilder: options.metadata as any,
              path: getCurrentFieldPath(),
              variables,
              $,
            });

            return mergeFields(builder({ f, $ }));
          },
          ...(options.metadata && { metadata: options.metadata }),
        };
      }) as never);
  };

  type ModelBuildersAll = {
    readonly [TTypeName in keyof TSchema["object"]]: TTypeName extends string ? ModelBuilder<TTypeName> : never;
  };
  type ModelBuilders = Omit<ModelBuildersAll, TSchema["operations"][OperationType] & keyof ModelBuildersAll>;

  return mapValues(schema.object, (_, typename) => createModelComposer(typename)) as ModelBuilders;
};
