/**
 * Extend composer factory for creating Operations from compat specs.
 * @module
 */

import { Kind, type OperationDefinitionNode, parse as parseGraphql } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";
import { type GqlDefine, Operation } from "../types/element";
import { type AnyCompatSpec, type CompatSpec, isTemplateCompatSpec, type TemplateCompatSpec } from "../types/element/compat-spec";
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
import type { VariableDefinitions } from "../types/type-foundation";
import { isPromiseLike } from "../utils/promise";

import { buildOperationArtifact } from "./operation-core";

/**
 * Options for extending a compat spec into a full operation.
 */
export type ExtendOptions<
  TSchema extends AnyGraphqlSchema,
  TVarDefinitions extends VariableDefinitions,
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
    TVarDefinitions extends VariableDefinitions,
    TFields extends AnyFields,
    TOperationMetadata = unknown,
  >(
    compat:
      | GqlDefine<CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>>
      | GqlDefine<TemplateCompatSpec>,
    options?: ExtendOptions<TSchema, TVarDefinitions, TOperationMetadata, TAggregatedFragmentMetadata, TSchemaLevel>,
  ) => {
    // Extract the spec from GqlDefine
    const spec = compat.value;

    // TemplateCompatSpec path — parse GraphQL and build operation directly
    if (isTemplateCompatSpec(spec as AnyCompatSpec | TemplateCompatSpec)) {
      return buildOperationFromTemplateSpec(
        schema,
        spec as TemplateCompatSpec,
        resolvedAdapter,
        // biome-ignore lint/suspicious/noExplicitAny: Options type narrowing not possible across union
        options as any,
        transformDocument,
      );
    }

    // Existing CompatSpec path — delegate to buildOperationArtifact
    const compatSpec = spec as CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>;
    const { operationType, operationName, variables, fieldsBuilder } = compatSpec;

    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName = schema.operations[operationType] as TTypeName;

    type DefineResult = Parameters<typeof Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>>[0];
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

/**
 * Builds an Operation from a TemplateCompatSpec by parsing the raw GraphQL source.
 * Delegates to buildOperationArtifact with pre-built document mode.
 */
const buildOperationFromTemplateSpec = <TSchema extends AnyGraphqlSchema, TAdapter extends AnyMetadataAdapter>(
  schema: TSchema,
  spec: TemplateCompatSpec,
  adapter: TAdapter,
  options:
    | ExtendOptions<
        TSchema,
        VariableDefinitions,
        unknown,
        ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"],
        ExtractAdapterTypes<TAdapter>["schemaLevel"]
      >
    | undefined,
  adapterTransformDocument:
    | DocumentTransformer<
        ExtractAdapterTypes<TAdapter>["schemaLevel"],
        ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"]
      >
    | undefined,
) => {
  const { operationType, operationName, graphqlSource } = spec;

  // 1. Parse the raw GraphQL source
  const document = parseGraphql(graphqlSource);

  // 2. Extract operation definition for variable analysis
  const opDef = document.definitions.find((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);
  if (!opDef) {
    throw new Error("No operation definition found in compat template spec");
  }

  // 3. Build VarSpecifiers from variable definitions
  const schemaIndex = createSchemaIndexFromSchema(spec.schema);
  const varSpecifiers = buildVarSpecifiers(opDef.variableDefinitions ?? [], schemaIndex);

  // 4. Determine root type name
  const operationTypeName = schema.operations[operationType] as keyof typeof schema.object & string;

  // 5. Delegate to buildOperationArtifact with pre-built document mode
  return Operation.create((() => {
    const artifact = buildOperationArtifact({
      schema,
      operationType,
      operationTypeName,
      operationName,
      variables: varSpecifiers as unknown as VariableDefinitions,
      prebuiltDocument: document,
      prebuiltVariableNames: Object.keys(varSpecifiers),
      adapter,
      metadata: options?.metadata,
      transformDocument: options?.transformDocument,
      adapterTransformDocument,
    });
    if (isPromiseLike(artifact)) {
      return artifact.then((a) => ({ ...a, documentSource: () => ({}) as never }));
    }
    return { ...artifact, documentSource: () => ({}) as never };
    // biome-ignore lint/suspicious/noExplicitAny: Type cast required for Operation.create with pre-built document
  }) as never) as any;
};
