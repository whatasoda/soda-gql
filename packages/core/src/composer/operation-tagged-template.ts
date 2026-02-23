/**
 * Operation tagged template function for creating GraphQL operations from template literals.
 * @module
 */

import { Kind, parse as parseGraphql } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";
import { Fragment, Operation } from "../types/element";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyOperationOf } from "../types/element/operation";
import type { AnyFieldsExtended } from "../types/fragment";
import type { AnyMetadataAdapter, DocumentTransformer } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { AnyVarRef, VariableDefinitions } from "../types/type-foundation";
import { buildDocument } from "./build-document";
import { buildFieldsFromSelectionSet } from "./fragment-tagged-template";
import { createVarAssignments } from "./input";
import { mergeVariableDefinitions } from "./merge-variable-definitions";

/** Callable result from tagged template - resolves to Operation or Fragment. */
export type TemplateResult<TElement extends AnyOperationOf<OperationType> | AnyFragment> = (
  options?: TemplateResultMetadataOptions,
) => TElement;

/** Options for TemplateResult resolution. */
export type TemplateResultMetadataOptions = {
  metadata?: unknown | ((context: { $: Readonly<Record<string, unknown>> }) => unknown | Promise<unknown>);
};

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
 * Creates a curried tagged template function for a specific operation type.
 * New API: `query("name")\`($var: Type!) { fields }\`` returns TemplateResult<Operation>.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 * @param _metadataAdapter - Optional metadata adapter (reserved for future use)
 * @param _transformDocument - Optional document transformer (reserved for future use)
 */
export const createOperationTaggedTemplate = <TSchema extends AnyGraphqlSchema, TOperationType extends OperationType>(
  schema: TSchema,
  operationType: TOperationType,
  _metadataAdapter?: AnyMetadataAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  _transformDocument?: DocumentTransformer<any, any>,
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

      return (options?: TemplateResultMetadataOptions): AnyOperationOf<TOperationType> => {
        // When there are no interpolations, use the parsed AST directly
        if (interpolationMap.size === 0) {
          return Operation.create(() => ({
            operationType,
            operationName,
            schemaLabel: schema.label,
            variableNames: Object.keys(varSpecifiers),
            documentSource: () => ({}) as never,
            document: document as never,
            metadata: options?.metadata,
            // biome-ignore lint/suspicious/noExplicitAny: Tagged template operations bypass full type inference
          })) as any;
        }

        // Build fields from selection set, resolving interpolated fragments
        const $ = createVarAssignments(varSpecifiers, {} as never);
        const fields = buildFieldsFromSelectionSet(
          opNode.selectionSet,
          schema,
          operationTypeName,
          $ as Readonly<Record<string, AnyVarRef>>,
          interpolationMap,
        );

        // Build the TypedDocumentNode from the resolved fields
        const builtDocument = buildDocument({
          operationName,
          operationType,
          operationTypeName,
          variables: varSpecifiers,
          fields,
          schema,
        });

        return Operation.create(() => ({
          operationType,
          operationName,
          schemaLabel: schema.label,
          variableNames: Object.keys(varSpecifiers),
          documentSource: () => fields,
          document: builtDocument as never,
          metadata: options?.metadata,
          // biome-ignore lint/suspicious/noExplicitAny: Tagged template operations bypass full type inference
        })) as any;
      };
    };
  };
};
