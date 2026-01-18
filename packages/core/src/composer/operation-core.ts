/**
 * Core operation building logic shared by operation and extend composers.
 * @module
 * @internal
 */

import type { FieldsBuilder } from "../types/element";
import type { AnyFields, DeclaredVariables } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DocumentTransformer,
  ExtractAdapterTypes,
  FragmentMetaInfo,
  MetadataBuilder,
  OperationDocumentTransformer,
} from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { isPromiseLike } from "../utils/promise";
import { buildDocument } from "./build-document";
import { createFieldFactories } from "./fields-builder";
import { withFragmentUsageCollection } from "./fragment-usage-context";
import { createVarRefs } from "./input";

/**
 * Parameters for building an operation artifact.
 * Used by both operation and extend composers.
 */
export type OperationCoreParams<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
> = {
  // Required
  readonly schema: TSchema;
  readonly operationType: TOperationType;
  readonly operationTypeName: TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
  readonly operationName: TOperationName;
  readonly variables: TVarDefinitions;
  readonly fieldsFactory: FieldsBuilder<
    TSchema,
    TSchema["operations"][TOperationType] & keyof TSchema["object"] & string,
    TVarDefinitions,
    TFields
  >;

  // Metadata handling
  readonly adapter: TAdapter;
  readonly metadata?: MetadataBuilder<
    DeclaredVariables<TSchema, TVarDefinitions>,
    TOperationMetadata,
    ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"],
    ExtractAdapterTypes<TAdapter>["schemaLevel"]
  >;
  readonly transformDocument?: OperationDocumentTransformer<TOperationMetadata>;
  readonly adapterTransformDocument?: DocumentTransformer<
    ExtractAdapterTypes<TAdapter>["schemaLevel"],
    ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"]
  >;
};

/**
 * Result type from buildOperationArtifact.
 * Matches the artifact shape expected by Operation.create().
 */
export type OperationArtifactResult<
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields,
  TOperationMetadata,
> = {
  readonly operationType: TOperationType;
  readonly operationName: TOperationName;
  readonly schemaLabel: string;
  readonly variableNames: (keyof TVarDefinitions & string)[];
  readonly documentSource: () => TFields;
  readonly document: ReturnType<typeof buildDocument>;
  readonly metadata: TOperationMetadata | undefined;
};

/**
 * Builds an operation artifact from the provided parameters.
 *
 * This function contains the core logic for:
 * - Creating variable refs and field factories
 * - Evaluating fields with fragment usage tracking
 * - Building the document
 * - Handling metadata (sync and async)
 * - Applying document transformations
 *
 * @param params - Operation building parameters
 * @returns Operation artifact or Promise of artifact (if async metadata)
 *
 * @internal Used by operation.ts and extend.ts
 */
export const buildOperationArtifact = <
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
>(
  params: OperationCoreParams<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields, TOperationMetadata, TAdapter>,
):
  | OperationArtifactResult<TOperationType, TOperationName, TVarDefinitions, TFields, TOperationMetadata>
  | Promise<OperationArtifactResult<TOperationType, TOperationName, TVarDefinitions, TFields, TOperationMetadata>> => {
  type TFragmentMetadata = ExtractAdapterTypes<TAdapter>["fragmentMetadata"];
  type TAggregatedFragmentMetadata = ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"];
  type TSchemaLevel = ExtractAdapterTypes<TAdapter>["schemaLevel"];

  const {
    schema,
    operationType,
    operationTypeName,
    operationName,
    variables,
    fieldsFactory,
    adapter,
    metadata: metadataBuilder,
    transformDocument: operationTransformDocument,
    adapterTransformDocument,
  } = params;

  // 1. Create tools
  const $ = createVarRefs<TSchema, TVarDefinitions>(variables);
  const f = createFieldFactories(schema, operationTypeName);

  // 2. Evaluate fields with fragment tracking
  const { result: fields, usages: fragmentUsages } = withFragmentUsageCollection(() => fieldsFactory({ f, $ }));

  // 3. Build document
  const document = buildDocument<TSchema, TFields, TVarDefinitions>({
    operationName,
    operationType,
    variables,
    fields,
    schema,
  });

  const variableNames = Object.keys(variables) as (keyof TVarDefinitions & string)[];

  // 4. Check if any fragment has a metadata builder
  const hasFragmentMetadata = fragmentUsages.some((u) => u.metadataBuilder);

  // Fast path: no metadata to evaluate and no transform
  if (!hasFragmentMetadata && !metadataBuilder && !adapterTransformDocument && !operationTransformDocument) {
    return {
      operationType,
      operationName,
      schemaLabel: schema.label,
      variableNames,
      documentSource: () => fields,
      document: document as ReturnType<typeof buildDocument>,
      metadata: undefined,
    };
  }

  // 5. Helper to aggregate fragment metadata
  const aggregateFragmentMetadata = (
    resolvedFragmentMetadata: (TFragmentMetadata | undefined)[],
  ): TAggregatedFragmentMetadata => {
    const fragmentMetaInfos: FragmentMetaInfo<TFragmentMetadata>[] = fragmentUsages.map((usage, index) => ({
      metadata: resolvedFragmentMetadata[index],
      fieldPath: usage.path,
    }));
    return adapter.aggregateFragmentMetadata(fragmentMetaInfos) as TAggregatedFragmentMetadata;
  };

  // 6. Evaluate fragment metadata first (sync or async)
  const fragmentMetadataResults: (TFragmentMetadata | undefined | Promise<TFragmentMetadata>)[] = fragmentUsages.map((usage) =>
    usage.metadataBuilder ? usage.metadataBuilder() : undefined,
  );

  // Check if any fragment metadata is async
  const hasAsyncFragmentMetadata = fragmentMetadataResults.some((r) => isPromiseLike(r));

  // 7. Helper to build operation metadata from aggregated fragment metadata
  const buildOperationMetadata = (
    aggregatedFragmentMetadata: TAggregatedFragmentMetadata,
  ): TOperationMetadata | undefined | Promise<TOperationMetadata | undefined> => {
    const schemaLevel = adapter.schemaLevel as TSchemaLevel | undefined;
    return metadataBuilder?.({ $, document, fragmentMetadata: aggregatedFragmentMetadata, schemaLevel });
  };

  // 8. Factory that creates the final artifact
  const makeCreateArtifact = (aggregated: TAggregatedFragmentMetadata) => {
    return ({
      metadata,
    }: {
      metadata: TOperationMetadata | undefined;
    }): OperationArtifactResult<TOperationType, TOperationName, TVarDefinitions, TFields, TOperationMetadata> => {
      // Step 1: Operation transform (typed metadata) - FIRST
      let finalDocument = operationTransformDocument
        ? (operationTransformDocument({
            document,
            metadata,
          }) as typeof document)
        : document;

      // Step 2: Adapter transform (schemaLevel + fragmentMetadata) - SECOND
      if (adapterTransformDocument) {
        finalDocument = adapterTransformDocument({
          document: finalDocument,
          operationName,
          operationType,
          variableNames,
          schemaLevel: adapter.schemaLevel as TSchemaLevel | undefined,
          fragmentMetadata: aggregated,
        }) as typeof document;
      }

      return {
        operationType,
        operationName,
        schemaLabel: schema.label,
        variableNames,
        documentSource: () => fields,
        document: finalDocument as ReturnType<typeof buildDocument>,
        metadata,
      };
    };
  };

  // 9. Handle async fragment metadata
  if (hasAsyncFragmentMetadata) {
    return Promise.all(fragmentMetadataResults).then(async (resolvedFragmentMetadata) => {
      const aggregated = aggregateFragmentMetadata(resolvedFragmentMetadata);
      const operationMetadata = await buildOperationMetadata(aggregated);
      return makeCreateArtifact(aggregated)({ metadata: operationMetadata });
    });
  }

  // 10. All fragment metadata is sync
  const syncFragmentMetadata = fragmentMetadataResults as (TFragmentMetadata | undefined)[];
  const aggregated = aggregateFragmentMetadata(syncFragmentMetadata);
  const createArtifact = makeCreateArtifact(aggregated);

  const operationMetadataResult = buildOperationMetadata(aggregated);

  // Use duck typing for VM sandbox compatibility
  if (isPromiseLike(operationMetadataResult)) {
    return operationMetadataResult.then((metadata) => createArtifact({ metadata }));
  }

  return createArtifact({ metadata: operationMetadataResult });
};
