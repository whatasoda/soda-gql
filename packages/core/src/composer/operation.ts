/**
 * Operation composer factory for creating typed GraphQL operations.
 * @module
 */

import { type FieldsBuilder, Operation } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DefaultMetadataAdapter,
  ExtractAdapterTypes,
  FragmentMetaInfo,
  MetadataBuilder,
} from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { withFragmentUsageCollection } from "./fragment-usage-context";
import { createVarRefs } from "./input";

/**
 * Creates a factory for composing GraphQL operations.
 *
 * Returns a curried function: first select operation type (query/mutation/subscription),
 * then define the operation with name, variables, and fields.
 *
 * Handles metadata aggregation from fragments (sync or async) and builds
 * the TypedDocumentNode automatically.
 *
 * @param schema - The GraphQL schema definition
 * @param adapter - Optional metadata adapter for custom metadata handling
 * @returns Operation type selector function
 *
 * @internal Used by `createGqlElementComposer`
 */
export const createOperationComposerFactory = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter,
>(
  schema: NoInfer<TSchema>,
  adapter?: TAdapter,
) => {
  const resolvedAdapter = adapter ?? (defaultMetadataAdapter as TAdapter);

  type TFragmentMetadata = ExtractAdapterTypes<TAdapter>["fragmentMetadata"];
  type TAggregatedFragmentMetadata = ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"];
  type TSchemaLevel = ExtractAdapterTypes<TAdapter>["schemaLevel"];

  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName: TTypeName | null = schema.operations[operationType];
    if (operationTypeName === null) {
      throw new Error(`Operation type ${operationType} is not defined in schema roots`);
    }

    return <
      TOperationName extends string,
      TFields extends AnyFields,
      TVarDefinitions extends InputTypeSpecifiers = {},
      TOperationMetadata = unknown,
    >(options: {
      name: TOperationName;
      variables?: TVarDefinitions;
      metadata?: MetadataBuilder<
        ReturnType<typeof createVarRefs<TSchema, TVarDefinitions>>,
        TOperationMetadata,
        TAggregatedFragmentMetadata,
        TSchemaLevel
      >;
      fields: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>;
    }) => {
      return Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>(() => {
        const { name: operationName } = options;
        const variables = (options.variables ?? {}) as TVarDefinitions;
        const $ = createVarRefs<TSchema, TVarDefinitions>(variables);
        const f = createFieldFactories(schema, operationTypeName);

        // Collect fragment usages during field building
        const { result: fields, usages: fragmentUsages } = withFragmentUsageCollection(() => options.fields({ f, $ }));

        const document = buildDocument<TSchema, TFields, TVarDefinitions>({
          operationName,
          operationType,
          variables,
          fields,
        });

        const createDefinition = (metadata: TOperationMetadata | undefined) => ({
          operationType,
          operationName,
          variableNames: Object.keys(variables) as (keyof TVarDefinitions & string)[],
          documentSource: () => fields,
          document,
          metadata,
        });

        // Check if any fragment has a metadata builder
        const hasFragmentMetadata = fragmentUsages.some((u) => u.metadataBuilder);

        if (!hasFragmentMetadata && !options.metadata) {
          // No metadata to evaluate
          return createDefinition(undefined);
        }

        // Evaluate fragment metadata first (sync or async)
        const fragmentMetadataResults: (TFragmentMetadata | undefined | Promise<TFragmentMetadata>)[] = fragmentUsages.map(
          (usage) => (usage.metadataBuilder ? usage.metadataBuilder() : undefined),
        );

        // Check if any fragment metadata is async
        const hasAsyncFragmentMetadata = fragmentMetadataResults.some((r) => r instanceof Promise);

        // Helper to aggregate and call operation metadata builder
        const buildOperationMetadata = (
          resolvedFragmentMetadata: (TFragmentMetadata | undefined)[],
        ): TOperationMetadata | undefined | Promise<TOperationMetadata | undefined> => {
          // Build FragmentMetaInfo array for adapter
          const fragmentMetaInfos: FragmentMetaInfo<TFragmentMetadata>[] = fragmentUsages.map((usage, index) => ({
            metadata: resolvedFragmentMetadata[index],
            fieldPath: usage.path,
          }));

          // Aggregate using the adapter
          const aggregatedFragmentMetadata = resolvedAdapter.aggregateFragmentMetadata(
            fragmentMetaInfos,
          ) as TAggregatedFragmentMetadata;

          // Call operation metadata builder with aggregated fragment metadata and schema-level config
          const schemaLevel = resolvedAdapter.schemaLevel as TSchemaLevel | undefined;
          return options.metadata?.({ $, document, fragmentMetadata: aggregatedFragmentMetadata, schemaLevel });
        };

        if (hasAsyncFragmentMetadata) {
          // Handle async fragment metadata
          return Promise.all(fragmentMetadataResults).then(async (resolvedFragmentMetadata) => {
            const operationMetadata = await buildOperationMetadata(resolvedFragmentMetadata);
            return createDefinition(operationMetadata);
          });
        }

        // All fragment metadata is sync, evaluate operation metadata
        const syncFragmentMetadata = fragmentMetadataResults as (TFragmentMetadata | undefined)[];
        const operationMetadataResult = buildOperationMetadata(syncFragmentMetadata);

        if (operationMetadataResult instanceof Promise) {
          return operationMetadataResult.then(createDefinition);
        }

        return createDefinition(operationMetadataResult);
      });
    };
  };
};
