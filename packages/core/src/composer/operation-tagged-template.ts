/**
 * Operation tagged template function for creating GraphQL operations from template literals.
 * Also supports options object dispatch for callback builder path.
 * @module
 */

import { Kind, parse as parseGraphql } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";
import { Fragment } from "../types/element";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyOperationOf } from "../types/element/operation";
import type { AnyFieldsExtended } from "../types/fragment";
import type { AnyMetadataAdapter, DocumentTransformer, OperationDocumentTransformer } from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import type { MinimalSchema, OperationType } from "../types/schema";
import type { AnyVarRef, VariableDefinitions } from "../types/type-foundation";
import type { FieldAccessorFunction, FieldsBuilder } from "./fields-builder";
import { buildFieldsFromSelectionSet, filterUnresolvedFragmentSpreads } from "./fragment-tagged-template";
import { mergeVariableDefinitions } from "./merge-variable-definitions";
import { buildOperationArtifact, wrapArtifactAsOperation } from "./operation-core";

/** Options for fragment TemplateResult resolution. */
export type FragmentTemplateMetadataOptions = {
  metadata?: unknown | ((context: { $: Readonly<Record<string, unknown>> }) => unknown | Promise<unknown>);
};

/** Context provided to operation metadata callbacks. */
export type OperationMetadataContext = {
  // biome-ignore lint/suspicious/noExplicitAny: Metadata context types are adapter-dependent; any allows test flexibility
  readonly $: Readonly<Record<string, any>>;
  readonly document: import("graphql").DocumentNode;
  // biome-ignore lint/suspicious/noExplicitAny: Aggregated fragment metadata shape depends on adapter
  readonly fragmentMetadata: any;
  // biome-ignore lint/suspicious/noExplicitAny: Schema-level metadata shape depends on adapter
  readonly schemaLevel: any;
};

/** Options for operation TemplateResult resolution — receives full metadata pipeline context. */
export type OperationTemplateMetadataOptions = {
  metadata?: unknown;
  /** Optional per-operation document transformer */
  transformDocument?: OperationDocumentTransformer<unknown>;
};

/** @deprecated Use `FragmentTemplateMetadataOptions` or `OperationTemplateMetadataOptions` instead. */
export type TemplateResultMetadataOptions = FragmentTemplateMetadataOptions;

/** Callable result from tagged template - resolves to Operation or Fragment. */
export type TemplateResult<
  TElement extends AnyOperationOf<OperationType> | AnyFragment,
  TOptions = TElement extends AnyOperationOf<OperationType> ? OperationTemplateMetadataOptions : FragmentTemplateMetadataOptions,
> = (options?: TOptions) => TElement;

/** Tagged template function type for operations. */
export type OperationTaggedTemplateFunction<TOperationType extends OperationType = OperationType> = (
  strings: TemplateStringsArray,
  ...values: (AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended))[]
) => TemplateResult<AnyOperationOf<TOperationType>>;

/** Options object for callback builder path */
export type OperationOptionsObject = {
  variables?: string;
  fields: FieldsBuilder;
};

/** Dispatch: tagged template OR options object */
export type OperationBuilderDispatch<TOperationType extends OperationType = OperationType> =
  & OperationTaggedTemplateFunction<TOperationType>
  & ((options: OperationOptionsObject) => TemplateResult<AnyOperationOf<TOperationType>>);

/** Curried operation function type: query("name")`($var: Type!) { fields }` or query("name")({ variables, fields }) */
export type CurriedOperationFunction<TOperationType extends OperationType = OperationType> = (
  operationName: string,
) => OperationBuilderDispatch<TOperationType>;

/**
 * Construct a synthetic GraphQL operation source from JS arguments and template body.
 * Handles optional variable declarations: `($var: Type!) { fields }` or `{ fields }`.
 */
function buildSyntheticOperationSource(operationType: OperationType, operationName: string, body: string): string {
  const trimmed = body.trim();
  // Body starts with "(" -> variable declarations present, directly prepend operation header
  // Body starts with "{" -> just selection set, prepend header with space
  // Either way: `<operationType> <name><body>` produces valid GraphQL
  return `${operationType} ${operationName} ${trimmed}`;
}

/**
 * Resolves a metadata option from OperationTemplateMetadataOptions into a MetadataBuilder
 * compatible with buildOperationArtifact.
 *
 * - `undefined` -> `undefined` (no metadata)
 * - Raw value -> `() => value` (static metadata)
 * - Callback -> forwarded directly (receives full pipeline context)
 */
// biome-ignore lint/suspicious/noExplicitAny: Private helper bridging untyped template options to typed MetadataBuilder
const resolveMetadataOption = (metadataOption: OperationTemplateMetadataOptions["metadata"]): any => {
  if (metadataOption === undefined) return undefined;
  if (typeof metadataOption === "function") return metadataOption;
  return () => metadataOption;
};

/**
 * Creates a curried function for a specific operation type.
 * Supports both tagged template and options object dispatch.
 *
 * Tagged template: `query("name")\`($var: Type!) { fields }\`` returns TemplateResult<Operation>.
 * Options object: `query("name")({ variables, fields })` returns TemplateResult<Operation>.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 * @param metadataAdapter - Optional metadata adapter for metadata aggregation
 * @param adapterTransformDocument - Optional document transformer from adapter
 */
export const createOperationTaggedTemplate = <TSchema extends MinimalSchema, TOperationType extends OperationType>(
  schema: TSchema,
  operationType: TOperationType,
  metadataAdapter?: AnyMetadataAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  adapterTransformDocument?: DocumentTransformer<any, any>,
): CurriedOperationFunction<TOperationType> => {
  const schemaIndex = createSchemaIndexFromSchema(schema);

  return (operationName: string): OperationBuilderDispatch<TOperationType> => {
    // Dispatcher function that checks the first argument to determine path
    const dispatch = (
      firstArg: TemplateStringsArray | OperationOptionsObject,
      ...rest: (AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended))[]
    ): TemplateResult<AnyOperationOf<TOperationType>> => {
      // Check if it's a tagged template (TemplateStringsArray has .raw)
      if ("raw" in firstArg) {
        return handleTaggedTemplate(
          schema,
          schemaIndex,
          operationType,
          operationName,
          metadataAdapter,
          adapterTransformDocument,
          firstArg as TemplateStringsArray,
          rest,
        );
      }

      // Options object path
      return handleOptionsObject(
        schema,
        schemaIndex,
        operationType,
        operationName,
        metadataAdapter,
        adapterTransformDocument,
        firstArg as OperationOptionsObject,
      );
    };

    return dispatch as OperationBuilderDispatch<TOperationType>;
  };
};

/**
 * Handles the tagged template path.
 */
function handleTaggedTemplate<TSchema extends MinimalSchema, TOperationType extends OperationType>(
  schema: TSchema,
  schemaIndex: import("../graphql/schema-index").SchemaIndex,
  operationType: TOperationType,
  operationName: string,
  metadataAdapter: AnyMetadataAdapter | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  adapterTransformDocument: DocumentTransformer<any, any> | undefined,
  strings: TemplateStringsArray,
  values: (AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended))[],
): TemplateResult<AnyOperationOf<TOperationType>> {
  // Validate interpolated values are fragments or callbacks
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!(value instanceof Fragment) && typeof value !== "function") {
      throw new Error(
        `Tagged templates only accept Fragment instances or callback functions as interpolated values. ` +
          `Received ${typeof value} at position ${i}.`,
      );
    }
  }

  // Build template body with placeholders for interpolations
  let body = strings[0] ?? "";
  const interpolationMap = new Map<
    string,
    AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended)
  >();

  for (let i = 0; i < values.length; i++) {
    const placeholderName = `__INTERPOLATION_${i}__`;
    interpolationMap.set(
      placeholderName,
      values[i] as AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended),
    );
    body += placeholderName + (strings[i + 1] ?? "");
  }

  // Construct synthetic GraphQL source from JS args and template body
  const source = buildSyntheticOperationSource(operationType, operationName, body);

  // Parse the GraphQL source with placeholders
  let document: import("graphql").DocumentNode;
  try {
    document = parseGraphql(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GraphQL parse error in tagged template: ${message}`);
  }

  const opDefs = document.definitions.filter((def) => def.kind === Kind.OPERATION_DEFINITION);
  if (opDefs.length !== 1) {
    throw new Error(`Internal error: expected exactly one operation definition in synthesized source`);
  }

  // biome-ignore lint/style/noNonNullAssertion: Length checked above
  const opNode = opDefs[0]!;
  if (opNode.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error("Unexpected definition kind");
  }

  const varDefNodes = opNode.variableDefinitions ?? [];
  let varSpecifiers = buildVarSpecifiers(varDefNodes, schemaIndex) as VariableDefinitions;

  // Merge variable definitions from interpolated fragments
  varSpecifiers = mergeVariableDefinitions(varSpecifiers, interpolationMap);

  // Check if any interpolated fragments contributed new variables.
  // If so, varDefNodes (from the parsed template) is incomplete — omit it so that
  // buildDocument derives VariableDefinitionNodes from the merged varSpecifiers instead.
  const hasInterpolatedFragmentVars = [...interpolationMap.values()].some(
    (v) => v instanceof Fragment && Object.keys(v.variableDefinitions).length > 0,
  );

  // Determine root type name based on operation type
  const operationTypeName = schema.operations[operationType];
  if (operationTypeName === null) {
    throw new Error(`Operation type ${operationType} is not defined in schema roots`);
  }

  const resolvedAdapter = metadataAdapter ?? defaultMetadataAdapter;

  return (options?: OperationTemplateMetadataOptions): AnyOperationOf<TOperationType> => {
    const resolvedMetadata = resolveMetadataOption(options?.metadata);

    return wrapArtifactAsOperation(() =>
      buildOperationArtifact({
        schema,
        operationType,
        operationTypeName,
        operationName,
        variables: varSpecifiers,
        variableDefinitionNodes: hasInterpolatedFragmentVars ? undefined : varDefNodes,
        fieldsFactory: ({ $ }) => {
          return buildFieldsFromSelectionSet(
            filterUnresolvedFragmentSpreads(opNode.selectionSet, interpolationMap),
            schema,
            operationTypeName,
            $ as Readonly<Record<string, AnyVarRef>>,
            interpolationMap,
          );
        },
        adapter: resolvedAdapter,
        metadata: resolvedMetadata,
        transformDocument: options?.transformDocument,
        adapterTransformDocument,
      }),
    );
  };
}

/**
 * Handles the options object path.
 */
function handleOptionsObject<TSchema extends MinimalSchema, TOperationType extends OperationType>(
  schema: TSchema,
  schemaIndex: import("../graphql/schema-index").SchemaIndex,
  operationType: TOperationType,
  operationName: string,
  metadataAdapter: AnyMetadataAdapter | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  adapterTransformDocument: DocumentTransformer<any, any> | undefined,
  options: OperationOptionsObject,
): TemplateResult<AnyOperationOf<TOperationType>> {
  // Parse variables from string if provided
  let varSpecifiers: VariableDefinitions = {};
  let varDefNodes: readonly import("graphql").VariableDefinitionNode[] = [];

  if (options.variables) {
    // options.variables is a string like "($id: ID!)" or "($id: ID!, $limit: Int)"
    // Parse it as GraphQL: wrap in a dummy operation to get variable definition nodes
    const varSource = `query __var_parse__ ${String(options.variables).trim()} { __typename }`;
    const parsed = parseGraphql(varSource);
    const opDef = parsed.definitions[0];
    if (opDef?.kind === Kind.OPERATION_DEFINITION) {
      varDefNodes = opDef.variableDefinitions ?? [];
      varSpecifiers = buildVarSpecifiers(varDefNodes, schemaIndex) as VariableDefinitions;
    }
  }

  const operationTypeName = schema.operations[operationType];
  if (operationTypeName === null) {
    throw new Error(`Operation type ${operationType} is not defined in schema roots`);
  }

  const resolvedAdapter = metadataAdapter ?? defaultMetadataAdapter;

  // Return TemplateResult (step 2 callable)
  return (step2Options?: OperationTemplateMetadataOptions): AnyOperationOf<TOperationType> => {
    const resolvedMetadata = resolveMetadataOption(step2Options?.metadata);

    return wrapArtifactAsOperation(() =>
      buildOperationArtifact({
        schema,
        operationType,
        operationTypeName,
        operationName,
        variables: varSpecifiers,
        variableDefinitionNodes: varDefNodes,
        fieldsFactory: options.fields,
        adapter: resolvedAdapter,
        metadata: resolvedMetadata,
        transformDocument: step2Options?.transformDocument,
        adapterTransformDocument,
      }),
    );
  };
}
