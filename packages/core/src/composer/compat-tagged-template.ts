/**
 * Compat tagged template function for creating deferred GraphQL operation specs.
 * Callback builder compat path is in compat.ts.
 * @module
 */

import { Kind, parse as parseGraphql } from "graphql";
import { GqlDefine } from "../types/element";
import type { TemplateCompatSpec } from "../types/element/compat-spec";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";

/** Tagged template function type for compat operations. */
export type CompatTaggedTemplate = (strings: TemplateStringsArray, ...values: never[]) => GqlDefine<TemplateCompatSpec>;

/** Curried compat function type: query.compat("name")`{ fields }` */
export type CurriedCompatFunction = (operationName: string) => CompatTaggedTemplate;

/**
 * Creates a curried tagged template function for compat mode operations.
 * New API: `query.compat("name")\`($vars) { fields }\`` returns GqlDefine<TemplateCompatSpec>.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type (query, mutation, subscription)
 */
export const createCompatTaggedTemplate = <TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
  operationType: OperationType,
): CurriedCompatFunction => {
  const operationTypeName = schema.operations[operationType];
  if (operationTypeName === null) {
    throw new Error(`Operation type ${operationType} is not defined in schema roots`);
  }

  return (operationName: string): CompatTaggedTemplate => {
    return (strings: TemplateStringsArray, ...values: never[]): GqlDefine<TemplateCompatSpec> => {
      if (values.length > 0) {
        throw new Error("Tagged templates must not contain interpolated expressions");
      }

      const body = strings[0] ?? "";

      // Construct synthetic GraphQL source from JS args and template body
      const source = `${operationType} ${operationName} ${body.trim()}`;

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

      return GqlDefine.create(() => ({
        schema,
        operationType,
        operationName,
        graphqlSource: source,
      }));
    };
  };
};
