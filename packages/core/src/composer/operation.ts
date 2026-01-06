/**
 * Operation composer factory for creating typed GraphQL operations.
 * @module
 */

import { type FieldsBuilder, Operation } from "../types/element";
import type { AnyFields } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DefaultMetadataAdapter,
  DocumentTransformer,
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
 * @param transformDocument - Optional document transformer called after building
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
  transformDocument?: DocumentTransformer<
    ExtractAdapterTypes<TAdapter>["schemaLevel"],
    ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"]
  >,
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

        const variableNames = Object.keys(variables) as (keyof TVarDefinitions & string)[];

        const createDefinition = ({
          metadata,
          aggregatedFragmentMetadata,
        }: {
          metadata: TOperationMetadata | undefined;
          aggregatedFragmentMetadata: TAggregatedFragmentMetadata | undefined;
        }) => {
          const finalDocument = transformDocument
            ? (transformDocument({
                document,
                operationName,
                operationType,
                variableNames,
                schemaLevel: resolvedAdapter.schemaLevel as TSchemaLevel | undefined,
                fragmentMetadata: aggregatedFragmentMetadata,
              }) as typeof document)
            : document;

          return {
            operationType,
            operationName,
            variableNames,
            documentSource: () => fields,
            document: finalDocument,
            metadata,
          };
        };

        // Check if any fragment has a metadata builder
        const hasFragmentMetadata = fragmentUsages.some((u) => u.metadataBuilder);

        // Helper to aggregate fragment metadata
        const aggregateFragmentMetadata = (
          resolvedFragmentMetadata: (TFragmentMetadata | undefined)[],
        ): TAggregatedFragmentMetadata => {
          const fragmentMetaInfos: FragmentMetaInfo<TFragmentMetadata>[] = fragmentUsages.map((usage, index) => ({
            metadata: resolvedFragmentMetadata[index],
            fieldPath: usage.path,
          }));
          return resolvedAdapter.aggregateFragmentMetadata(fragmentMetaInfos) as TAggregatedFragmentMetadata;
        };

        if (!hasFragmentMetadata && !options.metadata && !transformDocument) {
          // No metadata to evaluate and no transform
          return createDefinition({ metadata: undefined, aggregatedFragmentMetadata: undefined });
        }

        // Evaluate fragment metadata first (sync or async)
        const fragmentMetadataResults: (TFragmentMetadata | undefined | Promise<TFragmentMetadata>)[] = fragmentUsages.map(
          (usage) => (usage.metadataBuilder ? usage.metadataBuilder() : undefined),
        );

        // Check if any fragment metadata is async
        const hasAsyncFragmentMetadata = fragmentMetadataResults.some((r) => r instanceof Promise);

        // Helper to build operation metadata from aggregated fragment metadata
        const buildOperationMetadata = (
          aggregatedFragmentMetadata: TAggregatedFragmentMetadata,
        ): TOperationMetadata | undefined | Promise<TOperationMetadata | undefined> => {
          const schemaLevel = resolvedAdapter.schemaLevel as TSchemaLevel | undefined;
          return options.metadata?.({ $, document, fragmentMetadata: aggregatedFragmentMetadata, schemaLevel });
        };

        if (hasAsyncFragmentMetadata) {
          // Handle async fragment metadata
          return Promise.all(fragmentMetadataResults).then(async (resolvedFragmentMetadata) => {
            const aggregated = aggregateFragmentMetadata(resolvedFragmentMetadata);
            const operationMetadata = await buildOperationMetadata(aggregated);
            return createDefinition({ metadata: operationMetadata, aggregatedFragmentMetadata: aggregated });
          });
        }

        // All fragment metadata is sync
        const syncFragmentMetadata = fragmentMetadataResults as (TFragmentMetadata | undefined)[];
        const aggregated = aggregateFragmentMetadata(syncFragmentMetadata);
        const operationMetadataResult = buildOperationMetadata(aggregated);

        if (operationMetadataResult instanceof Promise) {
          return operationMetadataResult.then((metadata) =>
            createDefinition({ metadata, aggregatedFragmentMetadata: aggregated }),
          );
        }

        return createDefinition({ metadata: operationMetadataResult, aggregatedFragmentMetadata: aggregated });
      });
    };
  };
};
