/**
 * CompatSpec type for storing operation specifications from GraphQL files.
 * @module
 */

import type { AnyFields } from "../fragment";
import type { AnyGraphqlSchema, OperationType } from "../schema";
import type { VariableDefinitions } from "../type-foundation";
import type { FieldsBuilder } from "./fields-builder";

/**
 * Specification for a compat operation, storing unevaluated fieldsBuilder.
 * Created by `query.compat()`, `mutation.compat()`, `subscription.compat()`.
 *
 * The fieldsBuilder is stored unevaluated and will be evaluated when
 * `extend()` is called to create the final Operation.
 *
 * @template TSchema - The GraphQL schema type
 * @template TOperationType - The operation type ('query' | 'mutation' | 'subscription')
 * @template TOperationName - The operation name literal type
 * @template TVarDefinitions - The variable definitions type
 * @template TFields - The fields type returned by the fieldsBuilder
 *
 * @example
 * ```typescript
 * // This is created internally by query.compat()
 * const spec: CompatSpec<Schema, 'query', 'GetUser', { userId: VarSpec }, Fields> = {
 *   schema,
 *   operationType: 'query',
 *   operationName: 'GetUser',
 *   variables: { userId: varSpec },
 *   fieldsBuilder: ({ f, $ }) => ({ ...f.user({ id: $.userId })(...) }),
 * };
 * ```
 */
export type CompatSpec<
  TSchema extends AnyGraphqlSchema,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVarDefinitions extends VariableDefinitions,
  TFields extends AnyFields,
> = {
  readonly schema: TSchema;
  readonly operationType: TOperationType;
  readonly operationName: TOperationName;
  readonly variables: TVarDefinitions;
  readonly fieldsBuilder: FieldsBuilder<
    TSchema,
    TSchema["operations"][TOperationType] & keyof TSchema["object"] & string,
    TVarDefinitions,
    TFields
  >;
};

/**
 * Type alias for any CompatSpec instance.
 */
export type AnyCompatSpec = CompatSpec<AnyGraphqlSchema, OperationType, string, VariableDefinitions, AnyFields>;

/**
 * Extracts type information from a CompatSpec.
 * Used by extend() to infer types from the compat operation.
 */
export type ExtractCompatSpec<T> = T extends CompatSpec<
  infer TSchema,
  infer TOperationType,
  infer TOperationName,
  infer TVarDefinitions,
  infer TFields
>
  ? {
      schema: TSchema;
      operationType: TOperationType;
      operationName: TOperationName;
      variables: TVarDefinitions;
      fields: TFields;
    }
  : never;

/**
 * Specification for a tagged template compat operation.
 * Stores raw GraphQL source string instead of fieldsBuilder callback.
 * Created by `query.compat\`...\``, `mutation.compat\`...\``, `subscription.compat\`...\``.
 *
 * Unlike {@link CompatSpec}, this type is not generic — tagged template compat
 * does not carry type-level field or variable information. Types come from typegen.
 *
 * The graphqlSource is stored raw (unparsed). Parsing happens inside extend()
 * at extend-time, preserving the deferred execution model.
 */
export type TemplateCompatSpec = {
  readonly schema: AnyGraphqlSchema;
  readonly operationType: OperationType;
  readonly operationName: string;
  readonly graphqlSource: string;
};

/**
 * Type guard to distinguish TemplateCompatSpec from CompatSpec at runtime.
 * Uses structural discrimination (presence of `graphqlSource` field).
 */
export const isTemplateCompatSpec = (
  spec: AnyCompatSpec | TemplateCompatSpec,
): spec is TemplateCompatSpec => {
  return "graphqlSource" in spec && !("fieldsBuilder" in spec);
};

/**
 * Union type for specs that extend() can accept.
 * Includes both callback builder compat specs and tagged template compat specs.
 */
export type AnyExtendableSpec = AnyCompatSpec | TemplateCompatSpec;
