/**
 * Extend composer factory for creating Operations from compat specs.
 * @module
 */

import { parse as parseGraphql, Kind, type OperationDefinitionNode } from "graphql";
import { type GqlDefine, Operation } from "../types/element";
import {
  type AnyCompatSpec,
  type CompatSpec,
  type TemplateCompatSpec,
  isTemplateCompatSpec,
} from "../types/element/compat-spec";
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
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";
import { createVarRefs } from "./input";

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
    compat: GqlDefine<CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>> | GqlDefine<TemplateCompatSpec>,
    options?: ExtendOptions<TSchema, TVarDefinitions, TOperationMetadata, TAggregatedFragmentMetadata, TSchemaLevel>,
  ) => {
    // Extract the spec from GqlDefine
    const spec = compat.value;

    // TemplateCompatSpec path — parse GraphQL and build operation directly
    if (isTemplateCompatSpec(spec as AnyCompatSpec | TemplateCompatSpec)) {
      // biome-ignore lint/suspicious/noExplicitAny: Options type narrowing not possible across union
      return buildOperationFromTemplateSpec(schema, spec as TemplateCompatSpec, resolvedAdapter, options as any, transformDocument);
    }

    // Existing CompatSpec path — delegate to buildOperationArtifact
    const compatSpec = spec as CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>;
    const { operationType, operationName, variables, fieldsBuilder } = compatSpec;

    type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
    const operationTypeName = schema.operations[operationType] as TTypeName;

    type DefineResult = Parameters<typeof Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>>[0];
    // biome-ignore lint/suspicious/noExplicitAny: Type cast needed for compat spec fieldsBuilder
    return Operation.create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>((() =>
      buildOperationArtifact({
        schema,
        operationType,
        operationTypeName,
        operationName,
        variables: variables as TVarDefinitions,
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
 * This bypasses buildOperationArtifact since we have a DocumentNode, not a fieldsBuilder.
 */
const buildOperationFromTemplateSpec = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends AnyMetadataAdapter,
>(
  schema: TSchema,
  spec: TemplateCompatSpec,
  adapter: TAdapter,
  options: ExtendOptions<TSchema, VariableDefinitions, unknown, ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"], ExtractAdapterTypes<TAdapter>["schemaLevel"]> | undefined,
  adapterTransformDocument: DocumentTransformer<
    ExtractAdapterTypes<TAdapter>["schemaLevel"],
    ExtractAdapterTypes<TAdapter>["aggregatedFragmentMetadata"]
  > | undefined,
) => {
  const { operationType, operationName, graphqlSource } = spec;

  // 1. Parse the raw GraphQL source
  const document = parseGraphql(graphqlSource);

  // 2. Extract operation definition for variable analysis
  const opDef = document.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
  );
  if (!opDef) {
    throw new Error("No operation definition found in compat template spec");
  }

  // 3. Build VarSpecifiers from variable definitions
  const schemaIndex = createSchemaIndexFromSchema(spec.schema);
  const variables = buildVarSpecifiers(opDef.variableDefinitions ?? [], schemaIndex);
  const variableNames = Object.keys(variables);

  // 4. Create var refs for metadata builder (BuiltVarSpecifier is structurally compatible with VarSpecifier at runtime)
  const $ = createVarRefs(variables as unknown as VariableDefinitions);

  // 5. Handle metadata
  const metadataBuilder = options?.metadata;
  const operationTransformDocument = options?.transformDocument;

  // Fast path: no metadata
  if (!metadataBuilder && !adapterTransformDocument && !operationTransformDocument) {
    // biome-ignore lint/suspicious/noExplicitAny: Tagged template operations bypass full type inference
    return Operation.create(() => ({
      operationType,
      operationName,
      schemaLabel: schema.label,
      variableNames,
      documentSource: () => ({}) as never,
      document: document as never,
      metadata: undefined,
    })) as any;
  }

  // No fragment metadata for tagged template compat path
  const aggregated = adapter.aggregateFragmentMetadata([]);

  // Build operation metadata
  const operationMetadata = metadataBuilder?.({
    $,
    document,
    fragmentMetadata: aggregated,
    schemaLevel: adapter.schemaLevel,
  // biome-ignore lint/suspicious/noExplicitAny: Metadata builder generic params
  } as any);

  // Apply document transforms
  let finalDocument = operationTransformDocument
    ? operationTransformDocument({ document, metadata: operationMetadata } as never)
    : document;

  if (adapterTransformDocument) {
    finalDocument = adapterTransformDocument({
      document: finalDocument,
      operationName,
      operationType,
      variableNames,
      schemaLevel: adapter.schemaLevel,
      fragmentMetadata: aggregated,
    // biome-ignore lint/suspicious/noExplicitAny: Adapter transform generic params
    } as any);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Tagged template operations bypass full type inference
  return Operation.create(() => ({
    operationType,
    operationName,
    schemaLabel: schema.label,
    variableNames,
    documentSource: () => ({}) as never,
    document: finalDocument as never,
    metadata: operationMetadata,
  })) as any;
};
