/**
 * Compat tagged template function for creating deferred GraphQL operation specs.
 * Callback builder compat path is in compat.ts.
 * @module
 */

import { parse as parseGraphql, Kind } from "graphql";
import { GqlDefine } from "../types/element";
import type { TemplateCompatSpec } from "../types/element/compat-spec";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";

/** Tagged template function type for compat operations. */
export type CompatTaggedTemplate = (
  strings: TemplateStringsArray,
  ...values: never[]
) => GqlDefine<TemplateCompatSpec>;

/**
 * Creates a tagged template function for compat mode operations.
 *
 * Unlike direct mode (`query\`...\`()`), compat mode returns a `GqlDefine<TemplateCompatSpec>`
 * directly — no `()` call needed. The raw GraphQL source is stored for deferred execution
 * via `extend()`.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 */
export const createCompatTaggedTemplate = <TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
  operationType: OperationType,
): CompatTaggedTemplate => {
  const operationTypeName = schema.operations[operationType];
  if (operationTypeName === null) {
    throw new Error(`Operation type ${operationType} is not defined in schema roots`);
  }

  return (strings: TemplateStringsArray, ...values: never[]): GqlDefine<TemplateCompatSpec> => {
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

    return GqlDefine.create(() => ({
      schema,
      operationType,
      operationName,
      graphqlSource: source,
    }));
  };
};
