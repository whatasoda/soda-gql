/**
 * Extend composer factory for creating Operations from TemplateCompatSpec.
 * @module
 */

import { Kind, type OperationDefinitionNode, parse as parseGraphql } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";
import { type GqlDefine, Operation } from "../types/element";
import type { TemplateCompatSpec } from "../types/element/compat-spec";
import type { AnyFields } from "../types/fragment";
import type {
  AnyMetadataAdapter,
  DefaultMetadataAdapter,
  DocumentTransformer,
  ExtractAdapterTypes,
  MetadataBuilder,
  OperationDocumentTransformer,
} from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import type { MinimalSchema, OperationType } from "../types/schema";
import type { AnyVarRef, VariableDefinitions } from "../types/type-foundation";
import { buildFieldsFromSelectionSet, filterUnresolvedFragmentSpreads } from "./fragment-tagged-template";
import { buildOperationArtifact, wrapArtifactAsOperation } from "./operation-core";

/**
 * Options for extending a compat spec into a full operation.
 */
export type ExtendOptions<
  TSchema extends MinimalSchema,
  TVarDefinitions extends VariableDefinitions,
  TOperationMetadata,
  TAggregatedFragmentMetadata,
  TSchemaLevel,
> = {
  /** Optional metadata builder */
  metadata?: MetadataBuilder<Readonly<Record<string, AnyVarRef>>, TOperationMetadata, TAggregatedFragmentMetadata, TSchemaLevel>;
  /** Optional document transformer */
  transformDocument?: OperationDocumentTransformer<TOperationMetadata>;
};

/**
 * Creates a factory for extending compat specs into full operations.
 *
 * The extend function takes a TemplateCompatSpec (created by `query.compat("Name")\`...\``)
 * and optional metadata/transformDocument options, then creates a full Operation.
 *
 * @param schema - The GraphQL schema definition
 * @param adapter - Optional metadata adapter for custom metadata handling
 * @param transformDocument - Optional document transformer
 * @returns Extend composer function
 *
 * @internal Used by `createGqlElementComposer`
 */
export const createExtendComposer = <TSchema extends MinimalSchema, TAdapter extends AnyMetadataAdapter = DefaultMetadataAdapter>(
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
    compat: GqlDefine<TemplateCompatSpec>,
    options?: ExtendOptions<TSchema, TVarDefinitions, TOperationMetadata, TAggregatedFragmentMetadata, TSchemaLevel>,
  ) => {
    const spec = compat.value;

    return buildOperationFromTemplateSpec(
      schema,
      spec,
      resolvedAdapter,
      // biome-ignore lint/suspicious/noExplicitAny: Options type narrowing not possible across union
      options as any,
      transformDocument,
    );
  };
};

/**
 * Builds an Operation from a TemplateCompatSpec by parsing the raw GraphQL source.
 * Evaluates fields via buildFieldsFromSelectionSet for correct typegen output.
 */
const buildOperationFromTemplateSpec = <TSchema extends MinimalSchema, TAdapter extends AnyMetadataAdapter>(
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

  // 5. Filter named fragment spreads that can't be resolved without interpolation context
  const filteredSelectionSet = filterUnresolvedFragmentSpreads(opDef.selectionSet);

  // 6. Delegate to buildOperationArtifact with fieldsFactory and pre-parsed variableDefinitionNodes
  return wrapArtifactAsOperation(
    () =>
      buildOperationArtifact({
        schema,
        operationType,
        operationTypeName,
        operationName,
        variables: varSpecifiers as unknown as VariableDefinitions,
        variableDefinitionNodes: opDef.variableDefinitions ?? [],
        fieldsFactory: ({ $ }) => {
          return buildFieldsFromSelectionSet(
            filteredSelectionSet,
            schema,
            operationTypeName,
            $ as Readonly<Record<string, import("../types/type-foundation").AnyVarRef>>,
          );
        },
        adapter,
        metadata: options?.metadata,
        transformDocument: options?.transformDocument,
        adapterTransformDocument,
      }),
    // biome-ignore lint/suspicious/noExplicitAny: Type cast required for Operation.create with template compat spec
  ) as any;
};
