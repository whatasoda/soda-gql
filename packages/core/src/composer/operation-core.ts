/**
 * Core operation building logic shared by operation and extend composers.
 * @module
 * @internal
 */

import { type FieldsBuilder, Operation } from "../types/element";
import type { AnyOperationOf } from "../types/element/operation";
import type { AnyFieldsExtended, DeclaredVariables } from "../types/fragment";
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
import { createFieldFactories } from "./fields-builder";
import { withFragmentUsageCollection } from "./fragment-usage-context";
import { createVarRefs } from "./input";

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
 * Field factory mode: evaluates fields and builds document at runtime.
 * @internal
 */
type FieldsFactoryParams<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
> = OperationCoreParamsBase<TSchema, TOperationType, TOperationName, TVarDefinitions, TOperationMetadata, TAdapter> & {
  readonly fieldsFactory: FieldsBuilder<
    TSchema,
    TSchema["operations"][TOperationType] & keyof TSchema["object"] & string,
    TVarDefinitions,
    TFields
  >;
  readonly prebuiltDocument?: never;
  readonly prebuiltVariableNames?: never;
};

/**
 * Pre-built document mode: uses pre-parsed DocumentNode directly.
 * Fragment usages are empty (GraphQL-level fragment spreads in the AST
 * don't participate in soda-gql metadata pipeline).
 * @internal
 */
type PrebuiltDocumentParams<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
> = OperationCoreParamsBase<TSchema, TOperationType, TOperationName, TVarDefinitions, TOperationMetadata, TAdapter> & {
  readonly prebuiltDocument: import("graphql").DocumentNode;
  readonly prebuiltVariableNames?: string[];
  readonly fieldsFactory?: never;
};

/**
 * Parameters for building an operation artifact.
 * Used by both operation and extend composers.
 *
 * Discriminated union of two mutually exclusive modes:
 * - **Field factory mode**: Uses `fieldsFactory` to evaluate fields and build document.
 * - **Pre-built document mode**: Uses `prebuiltDocument` and `prebuiltVariableNames` to skip
 *   field evaluation and document building.
 */
export type OperationCoreParams<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFieldsExtended,
  TOperationMetadata,
  TAdapter extends AnyMetadataAdapter,
> =
  | FieldsFactoryParams<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields, TOperationMetadata, TAdapter>
  | PrebuiltDocumentParams<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields, TOperationMetadata, TAdapter>;

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
 * @internal Used by operation.ts, extend.ts, and operation-tagged-template.ts
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
    adapter,
    metadata: metadataBuilder,
    transformDocument: operationTransformDocument,
    adapterTransformDocument,
  } = params;

  // Create variable refs (needed for both field factory and metadata builder)
  const $ = createVarRefs<TSchema, TVarDefinitions>(variables);

  let document: import("graphql").DocumentNode;
  let variableNames: (keyof TVarDefinitions & string)[];
  let fields: TFields;
  type FragmentUsage = ReturnType<typeof withFragmentUsageCollection>["usages"];
  let fragmentUsages: FragmentUsage;

  if ("prebuiltDocument" in params && params.prebuiltDocument) {
    // Pre-built document mode: skip field eval + doc build.
    // GraphQL-level ...FragmentName exists in AST but doesn't participate
    // in soda-gql metadata pipeline (resolved by GraphQL runtime).
    document = params.prebuiltDocument;
    variableNames = (params.prebuiltVariableNames ?? []) as (keyof TVarDefinitions & string)[];
    fields = {} as TFields;
    fragmentUsages = [];
  } else {
    // Field factory mode: full field eval + doc build
    const { fieldsFactory } = params as FieldsFactoryParams<
      TSchema,
      TOperationType,
      TOperationName,
      TVarDefinitions,
      TFields,
      TOperationMetadata,
      TAdapter
    >;
    const f = createFieldFactories(schema, operationTypeName);

    // Evaluate fields with fragment tracking
    const collected = withFragmentUsageCollection(() => fieldsFactory({ f, $ }));
    fields = collected.result;
    fragmentUsages = collected.usages;

    // Build document
    document = buildDocument<
      TSchema,
      TSchema["operations"][TOperationType] & keyof TSchema["object"] & string,
      TFields,
      TVarDefinitions
    >({
      operationName,
      operationType,
      operationTypeName,
      variables,
      fields,
      schema,
    });

    variableNames = Object.keys(variables) as (keyof TVarDefinitions & string)[];
  }

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

/**
 * Wraps a buildOperationArtifact call into an Operation.create() invocation,
 * handling both sync and async artifact results.
 *
 * @param artifactFactory - Factory that produces the artifact (may return Promise for async metadata)
 * @param overrideDocumentSource - When true, overrides documentSource to return empty object.
 *   Required for pre-built document mode where fields = {} and the real documentSource is meaningless.
 *   Must be false for fieldsFactory mode to preserve real field selections.
 *
 * @internal Used by extend.ts and operation-tagged-template.ts
 */
export const wrapArtifactAsOperation = <TOperationType extends OperationType>(
  artifactFactory: () =>
    | OperationArtifactResult<TOperationType, string, VariableDefinitions, AnyFieldsExtended, unknown>
    | Promise<OperationArtifactResult<TOperationType, string, VariableDefinitions, AnyFieldsExtended, unknown>>,
  overrideDocumentSource: boolean,
): AnyOperationOf<TOperationType> => {
  // biome-ignore lint/suspicious/noExplicitAny: Type cast required for Operation.create with dynamic artifact
  return Operation.create((() => {
    const artifact = artifactFactory();
    if (overrideDocumentSource) {
      if (isPromiseLike(artifact)) {
        return artifact.then((a) => ({ ...a, documentSource: () => ({}) as never }));
      }
      return { ...artifact, documentSource: () => ({}) as never };
    }
    if (isPromiseLike(artifact)) {
      return artifact;
    }
    return artifact;
  }) as never) as any;
};
