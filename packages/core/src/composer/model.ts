import { type FieldsBuilder, type MergeFields, Model, mergeFields } from "../types/element";
import type { AnyFields, AssigningInput } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DefaultMetadataAdapter,
  ExtractAdapterTypes,
  ModelMetadataBuilder,
} from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";
import { getCurrentFieldPath } from "./field-path-context";
import { createFieldFactories } from "./fields-builder";
import { createVarAssignments, type createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";
import { recordModelUsage } from "./model-usage-context";

export const createGqlModelComposers = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter,
>(
  schema: NoInfer<TSchema>,
  _adapter?: TAdapter,
) => {
  type TModelMetadata = ExtractAdapterTypes<TAdapter>["modelMetadata"];

  type ModelBuilder<TTypeName extends keyof TSchema["object"] & string> = <
    TFieldEntries extends AnyFields[],
    TVarDefinitions extends InputTypeSpecifiers[] = [{}],
  >(
    options: {
      variables?: TVarDefinitions;
      metadata?: ModelMetadataBuilder<
        ReturnType<typeof createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>>,
        TModelMetadata
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
        metadata?: ModelMetadataBuilder<AssigningInput<TSchema, MergeVarDefinitions<TVarDefinitions>>, TModelMetadata>;
      },
      builder: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>,
    ) => {
      const varDefinitions = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
      const { metadata } = options;

      return Model.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>>(() => ({
        typename,
        embed: (variables) => {
          const f = createFieldFactories(schema, typename);
          const $ = createVarAssignments<TSchema, MergeVarDefinitions<TVarDefinitions>>(varDefinitions, variables);

          recordModelUsage({
            metadataBuilder: metadata ? () => metadata({ $ }) : null,
            path: getCurrentFieldPath(),
          });

          return mergeFields(builder({ f, $ }));
        },
      }));
    };
  };

  type ModelBuildersAll = {
    readonly [TTypeName in keyof TSchema["object"]]: TTypeName extends string ? ModelBuilder<TTypeName> : never;
  };

  // Include operation roots (Query, Mutation, Subscription) for fragment colocation
  // These allow defining reusable fragments on operation root types
  type ModelBuilders = ModelBuildersAll;

  return mapValues(schema.object, (_, typename) => createModelComposer(typename)) as ModelBuilders;
};
