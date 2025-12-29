import { type FieldsBuilder, Fragment, type MergeFields, mergeFields } from "../types/element";
import type { AnyFields, AssigningInput } from "../types/fragment";
import type { AnyMetadataAdapter, DefaultMetadataAdapter, ExtractAdapterTypes, FragmentMetadataBuilder } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";
import { getCurrentFieldPath } from "./field-path-context";
import { createFieldFactories } from "./fields-builder";
import { recordFragmentUsage } from "./fragment-usage-context";
import { createVarAssignments, type createVarRefs, type MergeVarDefinitions, mergeVarDefinitions } from "./input";

export const createGqlFragmentComposers = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter,
>(
  schema: NoInfer<TSchema>,
  _adapter?: TAdapter,
) => {
  type TFragmentMetadata = ExtractAdapterTypes<TAdapter>["fragmentMetadata"];

  type FragmentBuilder<TTypeName extends keyof TSchema["object"] & string> = <
    TFieldEntries extends AnyFields[],
    TVarDefinitions extends InputTypeSpecifiers[] = [{}],
  >(options: {
    variables?: TVarDefinitions;
    metadata?: FragmentMetadataBuilder<
      ReturnType<typeof createVarRefs<TSchema, MergeVarDefinitions<TVarDefinitions>>>,
      TFragmentMetadata
    >;
    fields: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>;
  }) => ReturnType<typeof Fragment.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>>>;

  const createFragmentComposer = <TTypeName extends keyof TSchema["object"] & string>(
    typename: TTypeName,
  ): FragmentBuilder<TTypeName> => {
    return <TFieldEntries extends AnyFields[], TVarDefinitions extends InputTypeSpecifiers[] = [{}]>(options: {
      variables?: TVarDefinitions;
      metadata?: FragmentMetadataBuilder<AssigningInput<TSchema, MergeVarDefinitions<TVarDefinitions>>, TFragmentMetadata>;
      fields: FieldsBuilder<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, TFieldEntries>;
    }) => {
      const varDefinitions = mergeVarDefinitions((options.variables ?? []) as TVarDefinitions);
      const { metadata, fields } = options;

      return Fragment.create<TSchema, TTypeName, MergeVarDefinitions<TVarDefinitions>, MergeFields<TFieldEntries>>(() => ({
        typename,
        embed: (variables) => {
          const f = createFieldFactories(schema, typename);
          const $ = createVarAssignments<TSchema, MergeVarDefinitions<TVarDefinitions>>(varDefinitions, variables);

          recordFragmentUsage({
            metadataBuilder: metadata ? () => metadata({ $ }) : null,
            path: getCurrentFieldPath(),
          });

          return mergeFields(fields({ f, $ }));
        },
      }));
    };
  };

  type FragmentBuildersAll = {
    readonly [TTypeName in keyof TSchema["object"]]: TTypeName extends string ? FragmentBuilder<TTypeName> : never;
  };

  // Include operation roots (Query, Mutation, Subscription) for fragment colocation
  // These allow defining reusable fragments on operation root types
  type FragmentBuilders = FragmentBuildersAll;

  return mapValues(schema.object, (_, typename) => createFragmentComposer(typename)) as FragmentBuilders;
};
