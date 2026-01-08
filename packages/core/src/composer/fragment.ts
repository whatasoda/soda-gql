/**
 * Fragment composer factory for creating reusable field selections.
 * @module
 */

import { type FieldsBuilder, Fragment } from "../types/element";
import type { AnyFields, DeclaredVariables } from "../types/fragment";
import type { AnyMetadataAdapter, DefaultMetadataAdapter, ExtractAdapterTypes, FragmentMetadataBuilder } from "../types/metadata";
import type { AnyGraphqlSchema } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";
import { mapValues } from "../utils/map-values";
import { getCurrentFieldPath } from "./field-path-context";
import { createFieldFactories } from "./fields-builder";
import { recordFragmentUsage } from "./fragment-usage-context";
import { createVarAssignments, type createVarRefs } from "./input";

/**
 * Type alias for a fragment builder function for a specific object type.
 *
 * Used by codegen to generate explicit fragment builder types instead of
 * expensive mapped types. This improves IDE performance for large schemas.
 */
export type FragmentBuilderFor<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter,
> = <
  TFields extends AnyFields,
  TVarDefinitions extends InputTypeSpecifiers = {},
  TKey extends string | undefined = undefined,
>(options: {
  /** Optional unique key for prebuilt type lookup. */
  key?: TKey;
  variables?: TVarDefinitions;
  metadata?: FragmentMetadataBuilder<
    ReturnType<typeof createVarRefs<TSchema, TVarDefinitions>>,
    ExtractAdapterTypes<TAdapter>["fragmentMetadata"]
  >;
  fields: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>;
}) => ReturnType<typeof Fragment.create<TSchema, TTypeName, TVarDefinitions, TFields, TKey>>;

/**
 * Creates fragment builder functions for all object types in the schema.
 *
 * Returns an object with a builder for each type (e.g., `fragment.User`, `fragment.Post`).
 * Each builder creates a `Fragment` that can be spread into operations.
 *
 * @param schema - The GraphQL schema definition
 * @param _adapter - Optional metadata adapter (for fragment metadata)
 * @returns Object mapping type names to fragment builder functions
 *
 * @internal Used by `createGqlElementComposer`
 */
export const createGqlFragmentComposers = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter,
>(
  schema: NoInfer<TSchema>,
  _adapter?: TAdapter,
) => {
  type TFragmentMetadata = ExtractAdapterTypes<TAdapter>["fragmentMetadata"];

  type FragmentBuilder<TTypeName extends keyof TSchema["object"] & string> = <
    TFields extends AnyFields,
    TVarDefinitions extends InputTypeSpecifiers = {},
    TKey extends string | undefined = undefined,
  >(options: {
    key?: TKey;
    variables?: TVarDefinitions;
    metadata?: FragmentMetadataBuilder<ReturnType<typeof createVarRefs<TSchema, TVarDefinitions>>, TFragmentMetadata>;
    fields: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>;
  }) => ReturnType<typeof Fragment.create<TSchema, TTypeName, TVarDefinitions, TFields, TKey>>;

  const createFragmentComposer = <TTypeName extends keyof TSchema["object"] & string>(
    typename: TTypeName,
  ): FragmentBuilder<TTypeName> => {
    return <
      TFields extends AnyFields,
      TVarDefinitions extends InputTypeSpecifiers = {},
      TKey extends string | undefined = undefined,
    >(options: {
      key?: TKey;
      variables?: TVarDefinitions;
      metadata?: FragmentMetadataBuilder<DeclaredVariables<TSchema, TVarDefinitions>, TFragmentMetadata>;
      fields: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>;
    }) => {
      const varDefinitions = (options.variables ?? {}) as TVarDefinitions;
      const { key, metadata, fields } = options;

      return Fragment.create<TSchema, TTypeName, TVarDefinitions, TFields, TKey>(() => ({
        typename,
        key: key as TKey,
        schemaLabel: schema.label,
        variableDefinitions: varDefinitions,
        spread: (variables) => {
          const f = createFieldFactories(schema, typename);
          const $ = createVarAssignments<TSchema, TVarDefinitions>(varDefinitions, variables);

          recordFragmentUsage({
            metadataBuilder: metadata ? () => metadata({ $ }) : null,
            path: getCurrentFieldPath(),
          });

          return fields({ f, $ });
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
