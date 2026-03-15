/**
 * Core operation building logic shared by operation and extend composers.
 * @module
 * @internal
 */

import type { VariableDefinitionNode } from "graphql";
import { Operation } from "../types/element";
import type { AnyOperationOf } from "../types/element/operation";
import type { AnyFieldsExtended } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DocumentTransformer,
  ExtractAdapterTypes,
  FragmentMetaInfo,
  MetadataBuilder,
  OperationDocumentTransformer,
} from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { VariableDefinitions } from "../types/type-foundation";
import { isPromiseLike } from "../utils/promise";
import { buildDocument } from "./build-document";
import type { FieldsBuilder } from "./fields-builder";
import { createFieldFactories } from "./fields-builder";
import { withFragmentUsageCollection } from "./fragment-usage-context";
import { createVarRefs } from "./input";
import { varRefTools } from "./var-ref-tools";

/**
 * Shared base parameters for building an operation artifact.
 * @internal
 */
type OperationCoreParamsBase<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
> = {
  readonly schema: TSchema;
  readonly operationType: TOperationType;
  readonly operationTypeName: TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
  readonly operationName: TOperationName;
  readonly variables: TVarDefinitions;
  /** Pre-parsed VariableDefinitionNode[] from tagged template or options object parser */
  readonly variableDefinitionNodes?: readonly VariableDefinitionNode[];
  readonly adapter: TAdapter;
  readonly metadata?: MetadataBuilder<
    Readonly<Record<string, import("../types/type-foundation").AnyVarRef>>,
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
 * Parameters for building an operation artifact.
 * Uses `fieldsFactory` to evaluate fields and build document.
 *
 * @internal Used by extend.ts and operation-tagged-template.ts
 */
export type OperationCoreParams<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
> = OperationCoreParamsBase<TSchema, TOperationType, TOperationName, TVarDefinitions, TOperationMetadata, TAdapter> & {
  readonly fieldsFactory: FieldsBuilder<TFields>;
};

/**
 * Result type from buildOperationArtifact.
 * Matches the artifact shape expected by Operation.create().
 */
export type OperationArtifactResult<
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
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
 * @internal Used by extend.ts and operation-tagged-template.ts
 */
export const buildOperationArtifact = <
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
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
    variableDefinitionNodes,
    adapter,
    metadata: metadataBuilder,
    transformDocument: operationTransformDocument,
    adapterTransformDocument,
  } = params;

  // Create variable refs (needed for both field factory and metadata builder)
  const $ = createVarRefs<TVarDefinitions>(variables);

  const { fieldsFactory } = params;
  const f = createFieldFactories(schema, operationTypeName);

  // Evaluate fields with fragment tracking
  const collected = withFragmentUsageCollection(() => fieldsFactory({ f, $ }));
  const fields = collected.result;
  type FragmentUsage = ReturnType<typeof withFragmentUsageCollection>["usages"];
  const fragmentUsages: FragmentUsage = collected.usages;

  // Build document
  const document = buildDocument<
    TSchema,
    TSchema["operations"][TOperationType] & keyof TSchema["object"] & string,
    TFields,
    TVarDefinitions
  >({
    operationName,
    operationType,
    operationTypeName,
    variableDefinitionNodes,
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
    return metadataBuilder?.({ $, $var: varRefTools, document, fragmentMetadata: aggregatedFragmentMetadata, schemaLevel });
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

/**
 * Wraps a buildOperationArtifact call into an Operation.create() invocation,
 * handling both sync and async artifact results.
 *
 * @param artifactFactory - Factory that produces the artifact (may return Promise for async metadata)
 *
 * @internal Used by extend.ts and operation-tagged-template.ts
 */
export const wrapArtifactAsOperation = <TOperationType extends OperationType>(
  artifactFactory: () =>
    | OperationArtifactResult<TOperationType, string, VariableDefinitions, AnyFieldsExtended, unknown>
    | Promise<OperationArtifactResult<TOperationType, string, VariableDefinitions, AnyFieldsExtended, unknown>>,
): AnyOperationOf<TOperationType> => {
  // biome-ignore lint/suspicious/noExplicitAny: Type cast required for Operation.create with dynamic artifact
  return Operation.create(artifactFactory as never) as any;
};
