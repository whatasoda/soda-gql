/**
 * Compat composer factory for creating GraphQL operation specifications.
 * @module
 */

import { type FieldsBuilder, GqlDefine } from "../types/element";
import type { CompatSpec } from "../types/element/compat-spec";
import type { AnyFields } from "../types/fragment";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import type { InputTypeSpecifiers } from "../types/type-foundation";

/**
 * Options for creating a compat operation specification.
 */
export type CompatOptions<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TOperationName extends string,
  TVarDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields,
> = {
  /** The operation name */
  name: TOperationName;
  /** Optional variable definitions */
  variables?: TVarDefinitions;
  /** Field selection builder */
  fields: FieldsBuilder<TSchema, TTypeName, TVarDefinitions, TFields>;
};

/**
 * Creates a factory for composing compat operation specifications.
 *
 * Returns a function that creates a `GqlDefine<CompatSpec<...>>` storing
 * the operation specification with unevaluated fieldsBuilder.
 *
 * @param schema - The GraphQL schema definition
 * @param operationType - The operation type ('query' | 'mutation' | 'subscription')
 * @returns Compat operation composer function
 *
 * @internal Used by `createGqlElementComposer`
 */
export const createCompatComposer = <TSchema extends AnyGraphqlSchema, TOperationType extends OperationType>(
  schema: NoInfer<TSchema>,
  operationType: TOperationType,
) => {
  type TTypeName = TSchema["operations"][TOperationType] & keyof TSchema["object"] & string;
  const operationTypeName: TTypeName | null = schema.operations[operationType];
  if (operationTypeName === null) {
    throw new Error(`Operation type ${operationType} is not defined in schema roots`);
  }

  return <TOperationName extends string, TFields extends AnyFields, TVarDefinitions extends InputTypeSpecifiers = {}>(
    options: CompatOptions<TSchema, TTypeName, TOperationName, TVarDefinitions, TFields>,
  ): GqlDefine<CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>> => {
    return GqlDefine.create(() => ({
      schema,
      operationType,
      operationName: options.name,
      variables: (options.variables ?? {}) as TVarDefinitions,
      fieldsBuilder: options.fields,
    }));
  };
};
