/**
 * Operation tagged template function for creating GraphQL operations from template literals.
 * @module
 */

import { parse as parseGraphql, Kind } from "graphql";
import { Operation } from "../types/element";
import type { AnyMetadataAdapter, DocumentTransformer } from "../types/metadata";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyOperation } from "../types/element/operation";
import { buildVarSpecifiers, createSchemaIndexFromSchema } from "../graphql";

/** Callable result from tagged template - resolves to Operation or Fragment. */
export type TemplateResult<TElement extends AnyOperation | AnyFragment> = {
  (options?: TemplateResultMetadataOptions): TElement;
};

/** Options for TemplateResult resolution. */
export type TemplateResultMetadataOptions = {
  metadata?: unknown;
};

/** Tagged template function type for operations. */
export type OperationTaggedTemplateFunction = (
  strings: TemplateStringsArray,
  ...values: never[]
) => TemplateResult<AnyOperation>;

/**
 * Creates a tagged template function for a specific operation type.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 * @param _metadataAdapter - Optional metadata adapter (reserved for future use)
 * @param _transformDocument - Optional document transformer (reserved for future use)
 */
export const createOperationTaggedTemplate = <TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
  operationType: OperationType,
  _metadataAdapter?: AnyMetadataAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  _transformDocument?: DocumentTransformer<any, any>,
): OperationTaggedTemplateFunction => {
  const schemaIndex = createSchemaIndexFromSchema(schema);

  return (strings: TemplateStringsArray, ...values: never[]): TemplateResult<AnyOperation> => {
    if (values.length > 0) {
      throw new Error("Tagged templates must not contain interpolated expressions");
    }

    const source = strings[0]!;

    let document;
    try {
      document = parseGraphql(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GraphQL parse error in tagged template: ${message}`);
    }

    const opDefs = document.definitions.filter((def) => def.kind === Kind.OPERATION_DEFINITION);
    if (opDefs.length !== 1) {
      throw new Error(`Expected exactly one operation definition, found ${opDefs.length}`);
    }

    const opNode = opDefs[0]!;
    if (opNode.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error("Unexpected definition kind");
    }

    if (!opNode.name) {
      throw new Error("Anonymous operations are not allowed in tagged templates");
    }

    if (opNode.operation !== operationType) {
      throw new Error(
        `Operation type mismatch: expected "${operationType}", got "${opNode.operation}"`,
      );
    }

    const operationName = opNode.name.value;
    const varDefNodes = opNode.variableDefinitions ?? [];
    const varSpecifiers = buildVarSpecifiers(varDefNodes, schemaIndex);

    return (options?: TemplateResultMetadataOptions): AnyOperation => {
      // biome-ignore lint/suspicious/noExplicitAny: Tagged template operations bypass full type inference
      return Operation.create(() => ({
        operationType,
        operationName,
        schemaLabel: schema.label,
        variableNames: Object.keys(varSpecifiers),
        documentSource: () => ({}) as never,
        document: document as never,
        metadata: options?.metadata,
      })) as any;
    };
  };
};
