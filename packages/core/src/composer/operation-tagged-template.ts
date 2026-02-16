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

/**
 * Creates a tagged template function for a specific operation type.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 * @param _metadataAdapter - Optional metadata adapter (reserved for future use)
 * @param _transformDocument - Optional document transformer (reserved for future use)
 */
/**
 * Merge variable definitions from interpolated fragments into the parent's variable definitions.
 * Deduplicates variables with matching names and types, throws on conflicting types.
 */
function mergeVariableDefinitions(
  parentVars: VariableDefinitions,
  interpolationMap: ReadonlyMap<string, AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended)>,
): VariableDefinitions {
  const merged: Record<string, VariableDefinitions[string]> = { ...parentVars };

  for (const value of interpolationMap.values()) {
    // Only direct Fragment instances have variable definitions to merge
    // Callback interpolations handle their own variable context
    if (value instanceof Fragment) {
      const childVars = value.variableDefinitions;
      for (const [varName, varDef] of Object.entries(childVars)) {
        if (varName in merged) {
          // Variable already exists - check if types match
          const existing = merged[varName];
          // Compare kind, name, and modifier to determine if types are compatible
          if (
            existing?.kind !== varDef.kind ||
            existing?.name !== varDef.name ||
            existing?.modifier !== varDef.modifier
          ) {
            throw new Error(
              `Variable definition conflict: $${varName} is defined with incompatible types ` +
              `(${existing?.kind}:${existing?.name}:${existing?.modifier} vs ${varDef.kind}:${varDef.name}:${varDef.modifier})`
            );
          }
          // Types match - no need to duplicate
        } else {
          // New variable - add to merged definitions
          merged[varName] = varDef;
        }
      }
    }
  }

  return merged as VariableDefinitions;
}

export const createOperationTaggedTemplate = <TSchema extends AnyGraphqlSchema, TOperationType extends OperationType>(
  schema: TSchema,
  operationType: TOperationType,
  _metadataAdapter?: AnyMetadataAdapter,
  // biome-ignore lint/suspicious/noExplicitAny: DocumentTransformer generic params not needed here
  _transformDocument?: DocumentTransformer<any, any>,
): OperationTaggedTemplateFunction<TOperationType> => {
  const schemaIndex = createSchemaIndexFromSchema(schema);

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
          `Received ${typeof value} at position ${i}.`
        );
      }
    }

    // Build GraphQL source with placeholder fragment spread names for interpolations
    // This allows us to parse the GraphQL and later replace placeholders with actual fragment fields
    let source = strings[0] ?? "";
    const interpolationMap = new Map<string, AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended)>();

    for (let i = 0; i < values.length; i++) {
      const placeholderName = `__INTERPOLATION_${i}__`;
      interpolationMap.set(placeholderName, values[i] as AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended));
      source += placeholderName + (strings[i + 1] ?? "");
    }

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
      throw new Error(`Expected exactly one operation definition, found ${opDefs.length}`);
    }

    // biome-ignore lint/style/noNonNullAssertion: Length checked above
    const opNode = opDefs[0]!;
    if (opNode.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error("Unexpected definition kind");
    }

    if (!opNode.name) {
      throw new Error("Anonymous operations are not allowed in tagged templates");
    }

    if (opNode.operation !== operationType) {
      throw new Error(`Operation type mismatch: expected "${operationType}", got "${opNode.operation}"`);
    }

    const operationName = opNode.name.value;
    const varDefNodes = opNode.variableDefinitions ?? [];
    // BuiltVarSpecifier is structurally compatible at runtime; cast needed because
    // BuiltVarSpecifier.defaultValue uses `unknown` while VarSpecifier uses `ConstValue`
    let varSpecifiers = buildVarSpecifiers(varDefNodes, schemaIndex) as VariableDefinitions;

    // Merge variable definitions from interpolated fragments
    varSpecifiers = mergeVariableDefinitions(varSpecifiers, interpolationMap);

    // Determine root type name based on operation type
    const operationTypeName = schema.operations[operationType] as keyof typeof schema.object & string;

    return (options?: TemplateResultMetadataOptions): AnyOperationOf<TOperationType> => {
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
