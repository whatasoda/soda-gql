/**
 * Extend composer factory for creating Operations from compat specs.
 * @module
 */

import { type GqlDefine, Operation } from "../types/element";
import type { CompatSpec } from "../types/element/compat-spec";
import type { AnyFields, DeclaredVariables } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DefaultMetadataAdapter,
  DocumentTransformer,
  ExtractAdapterTypes,
  FragmentMetaInfo,
  MetadataBuilder,
  OperationDocumentTransformer,
} from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { isPromiseLike } from "../utils/promise";
import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { withFragmentUsageCollection } from "./fragment-usage-context";
import { createVarRefs } from "./input";

/**
 * Options for extending a compat spec into a full operation.
 */
export type ExtendOptions<
  TSchema extends AnyGraphqlSchema,
  TVarDefinitions extends InputTypeSpecifiers,
  TOperationMetadata,
  TAggregatedFragmentMetadata,
  TSchemaLevel,
> = {
  /** Optional metadata builder */
  metadata?: MetadataBuilder<
    DeclaredVariables<TSchema, TVarDefinitions>,
    TOperationMetadata,
    TAggregatedFragmentMetadata,
    TSchemaLevel
  >;
  /** Optional document transformer */
  transformDocument?: OperationDocumentTransformer<TOperationMetadata>;
};

/**
 * Creates a factory for extending compat specs into full operations.
 *
 * The extend function takes a compat spec (created by `query.compat()`) and
 * optional metadata/transformDocument options, then creates a full Operation.
 *
 * @param schema - The GraphQL schema definition
 * @param adapter - Optional metadata adapter for custom metadata handling
 * @param transformDocument - Optional document transformer
 * @returns Extend composer function
 *
 * @internal Used by `createGqlElementComposer`
 */
export const createExtendComposer = <
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

  return <
    TOperationType extends OperationType,
    TOperationName extends string,
    TVarDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
    TOperationMetadata = unknown,
  >(
    compat: GqlDefine<CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>>,
    options?: ExtendOptions<TSchema, TVarDefinitions, TOperationMetadata, TAggregatedFragmentMetadata, TSchemaLevel>,
  ) => {
    // Extract the spec from GqlDefine
    const spec = compat.value;
    const { operationType, operationName, variables, fieldsBuilder } = spec;

    // Get the operation type name from schema
    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName = schema.operations[operationType] as TTypeName;

    return Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>(() => {
      const $ = createVarRefs<TSchema, TVarDefinitions>(variables);
      const f = createFieldFactories(schema, operationTypeName);

      // Collect fragment usages during field building - cast to handle type inference
      const { result: fields, usages: fragmentUsages } = withFragmentUsageCollection(
        () => fieldsBuilder({ f, $ } as Parameters<typeof fieldsBuilder>[0]) as TFields,
      );

      const document = buildDocument<TSchema, TFields, TVarDefinitions>({
        operationName,
        operationType,
        variables: variables as TVarDefinitions,
        fields,
        schema,
      });

      const variableNames = Object.keys(variables) as (keyof TVarDefinitions & string)[];

      // Check if any fragment has a metadata builder
      const hasFragmentMetadata = fragmentUsages.some((u) => u.metadataBuilder);

      if (!hasFragmentMetadata && !options?.metadata && !transformDocument && !options?.transformDocument) {
        // No metadata to evaluate and no transform - return directly
        return {
          operationType: operationType as TOperationType,
          operationName: operationName as TOperationName,
          schemaLabel: schema.label,
          variableNames,
          documentSource: () => fields,
          document,
          metadata: undefined,
        };
      }

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

      // Evaluate fragment metadata first (sync or async)
      const fragmentMetadataResults: (TFragmentMetadata | undefined | Promise<TFragmentMetadata>)[] = fragmentUsages.map(
        (usage) => (usage.metadataBuilder ? usage.metadataBuilder() : undefined),
      );

      // Check if any fragment metadata is async
      const hasAsyncFragmentMetadata = fragmentMetadataResults.some((r) => isPromiseLike(r));

      // Helper to build operation metadata from aggregated fragment metadata
      const buildOperationMetadata = (
        aggregatedFragmentMetadata: TAggregatedFragmentMetadata,
      ): TOperationMetadata | undefined | Promise<TOperationMetadata | undefined> => {
        const schemaLevel = resolvedAdapter.schemaLevel as TSchemaLevel | undefined;
        return options?.metadata?.({ $, document, fragmentMetadata: aggregatedFragmentMetadata, schemaLevel });
      };

      // Factory that captures aggregated via closure
      const makeCreateDefinition = (aggregated: TAggregatedFragmentMetadata) => {
        return ({ metadata }: { metadata: TOperationMetadata | undefined }) => {
          // Step 1: Operation transform (typed metadata) - FIRST
          let finalDocument = options?.transformDocument
            ? (options.transformDocument({
                document,
                metadata,
              }) as typeof document)
            : document;

          // Step 2: Adapter transform (schemaLevel + fragmentMetadata) - SECOND
          if (transformDocument) {
            finalDocument = transformDocument({
              document: finalDocument,
              operationName,
              operationType,
              variableNames,
              schemaLevel: resolvedAdapter.schemaLevel as TSchemaLevel | undefined,
              fragmentMetadata: aggregated,
            }) as typeof document;
          }

          return {
            operationType: operationType as TOperationType,
            operationName: operationName as TOperationName,
            schemaLabel: schema.label,
            variableNames,
            documentSource: () => fields,
            document: finalDocument,
            metadata,
          };
        };
      };

      if (hasAsyncFragmentMetadata) {
        // Handle async fragment metadata
        return Promise.all(fragmentMetadataResults).then(async (resolvedFragmentMetadata) => {
          const aggregated = aggregateFragmentMetadata(resolvedFragmentMetadata);
          const operationMetadata = await buildOperationMetadata(aggregated);
          return makeCreateDefinition(aggregated)({ metadata: operationMetadata });
        });
      }

      // All fragment metadata is sync
      const syncFragmentMetadata = fragmentMetadataResults as (TFragmentMetadata | undefined)[];
      const aggregated = aggregateFragmentMetadata(syncFragmentMetadata);
      const createDefinition = makeCreateDefinition(aggregated);

      const operationMetadataResult = buildOperationMetadata(aggregated);

      // Use duck typing for VM sandbox compatibility
      if (isPromiseLike(operationMetadataResult)) {
        return operationMetadataResult.then((metadata) => createDefinition({ metadata }));
      }

      return createDefinition({ metadata: operationMetadataResult });
    });
  };
};
