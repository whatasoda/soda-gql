/**
 * Operation composer factory for creating typed GraphQL operations.
 * @module
 */

import { type FieldsBuilder, Operation } from "../types/element";
import type { AnyFieldsExtended } from "../types/fragment";
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
import type { VariableDefinitions } from "../types/type-foundation";
import type { createVarRefs } from "./input";
import { buildOperationArtifact } from "./operation-core";

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
      TFields extends AnyFieldsExtended,
      TVarDefinitions extends VariableDefinitions = {},
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
      transformDocument?: OperationDocumentTransformer<TOperationMetadata>;
    }) => {
      type DefineResult = Parameters<
        typeof Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>
      >[0];
      return Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>((() =>
        buildOperationArtifact({
          schema,
          operationType,
          operationTypeName,
          operationName: options.name,
          variables: (options.variables ?? {}) as TVarDefinitions,
          fieldsFactory: options.fields,
          adapter: resolvedAdapter,
          metadata: options.metadata,
          transformDocument: options.transformDocument,
          adapterTransformDocument: transformDocument,
        })) as DefineResult);
    };
  };
};
