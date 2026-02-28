/**
 * Operation tagged template function for creating GraphQL operations from template literals.
 * @module
 */

import { Kind, parse as parseGraphql } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";
import { Fragment } from "../types/element";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyOperationOf } from "../types/element/operation";
import type { AnyFieldsExtended } from "../types/fragment";
import type { AnyMetadataAdapter, DocumentTransformer } from "../types/metadata";
import { defaultMetadataAdapter } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { AnyVarRef, VariableDefinitions } from "../types/type-foundation";
import { buildFieldsFromSelectionSet } from "./fragment-tagged-template";
import { createVarAssignments } from "./input";
import { mergeVariableDefinitions } from "./merge-variable-definitions";
import { buildOperationArtifact, wrapArtifactAsOperation } from "./operation-core";

/** Options for fragment TemplateResult resolution. */
export type FragmentTemplateMetadataOptions = {
  metadata?: unknown | ((context: { $: Readonly<Record<string, unknown>> }) => unknown | Promise<unknown>);
};

/** Options for operation TemplateResult resolution — receives full metadata pipeline context. */
export type OperationTemplateMetadataOptions = {
  metadata?:
    | unknown
    | ((context: {
        $: Readonly<Record<string, unknown>>;
        document: import("graphql").DocumentNode;
        fragmentMetadata: unknown;
        schemaLevel: unknown;
      }) => unknown | Promise<unknown>);
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

/** Curried operation function type: query("name")`($var: Type!) { fields }` */
export type CurriedOperationFunction<TOperationType extends OperationType = OperationType> = (
  operationName: string,
) => OperationTaggedTemplateFunction<TOperationType>;

/**
 * Construct a synthetic GraphQL operation source from JS arguments and template body.
 * Handles optional variable declarations: `($var: Type!) { fields }` or `{ fields }`.
 */
function buildSyntheticOperationSource(operationType: OperationType, operationName: string, body: string): string {
  const trimmed = body.trim();
  // Body starts with "(" → variable declarations present, directly prepend operation header
  // Body starts with "{" → just selection set, prepend header with space
  // Either way: `<operationType> <name><body>` produces valid GraphQL
  return `${operationType} ${operationName} ${trimmed}`;
}

/**
 * Resolves a metadata option from OperationTemplateMetadataOptions into a MetadataBuilder
 * compatible with buildOperationArtifact.
 *
 * - `undefined` → `undefined` (no metadata)
 * - Raw value → `() => value` (static metadata)
 * - Callback → forwarded directly (receives full pipeline context)
 */
// biome-ignore lint/suspicious/noExplicitAny: Private helper bridging untyped template options to typed MetadataBuilder
const resolveMetadataOption = (metadataOption: OperationTemplateMetadataOptions["metadata"]): any => {
  if (metadataOption === undefined) return undefined;
  if (typeof metadataOption === "function") return metadataOption;
  return () => metadataOption;
};

/**
 * Creates a curried tagged template function for a specific operation type.
 * New API: `query("name")\`($var: Type!) { fields }\`` returns TemplateResult<Operation>.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 * @param metadataAdapter - Optional metadata adapter for metadata aggregation
 * @param adapterTransformDocument - Optional document transformer from adapter
 */
export const createOperationTaggedTemplate = <TSchema extends AnyGraphqlSchema, TOperationType extends OperationType>(
  schema: TSchema,
  operationType: TOperationType,
  metadataAdapter?: AnyMetadataAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  adapterTransformDocument?: DocumentTransformer<any, any>,
): CurriedOperationFunction<TOperationType> => {
  const schemaIndex = createSchemaIndexFromSchema(schema);

  return (operationName: string): OperationTaggedTemplateFunction<TOperationType> => {
    return (
      strings: TemplateStringsArray,
      ...values: (AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended))[]
    ): TemplateResult<AnyOperationOf<TOperationType>> => {
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

      // Determine root type name based on operation type
      const operationTypeName = schema.operations[operationType] as keyof typeof schema.object & string;

      const resolvedAdapter = metadataAdapter ?? defaultMetadataAdapter;

      return (options?: OperationTemplateMetadataOptions): AnyOperationOf<TOperationType> => {
        const resolvedMetadata = resolveMetadataOption(options?.metadata);

        if (interpolationMap.size === 0) {
          // No interpolations: use pre-built document mode
          return wrapArtifactAsOperation(
            () =>
              buildOperationArtifact({
                mode: "prebuilt",
                schema,
                operationType,
                operationTypeName,
                operationName,
                variables: varSpecifiers,
                prebuiltDocument: document,
                prebuiltVariableNames: Object.keys(varSpecifiers),
                adapter: resolvedAdapter,
                metadata: resolvedMetadata,
                adapterTransformDocument,
              }),
            true,
          );
        }

        // Interpolations present: use fieldsFactory mode for fragment usage tracking
        return wrapArtifactAsOperation(
          () =>
            buildOperationArtifact({
              mode: "fieldsFactory",
              schema,
              operationType,
              operationTypeName,
              operationName,
              variables: varSpecifiers,
              fieldsFactory: () => {
                const varAssignments = createVarAssignments(varSpecifiers, {} as never);
                return buildFieldsFromSelectionSet(
                  opNode.selectionSet,
                  schema,
                  operationTypeName,
                  varAssignments as Readonly<Record<string, AnyVarRef>>,
                  interpolationMap,
                );
              },
              adapter: resolvedAdapter,
              metadata: resolvedMetadata,
              adapterTransformDocument,
            }),
          false,
        );
      };
    };
  };
};
