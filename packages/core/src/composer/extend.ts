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
  MetadataBuilder,
  OperationDocumentTransformer,
} from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

import { buildOperationArtifact } from "./operation-core";

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

    type DefineResult = Parameters<typeof Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>>[0];
    // Type assertion needed because compat spec stores fieldsBuilder with schema-specific types
    // that are compatible at runtime but need casting for TypeScript
    return Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>((() =>
      buildOperationArtifact({
        schema,
        operationType,
        operationTypeName,
        operationName,
        variables: variables as TVarDefinitions,
        // biome-ignore lint/suspicious/noExplicitAny: Type cast needed for compat spec fieldsBuilder
        fieldsFactory: fieldsBuilder as any,
        adapter: resolvedAdapter,
        metadata: options?.metadata,
        transformDocument: options?.transformDocument,
        adapterTransformDocument: transformDocument,
      })) as unknown as DefineResult);
  };
};
