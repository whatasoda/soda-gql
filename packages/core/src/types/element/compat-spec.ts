/**
 * CompatSpec type for storing operation specifications from GraphQL files.
 * @module
 */

import type { AnyFields } from "../fragment";
import type { AnyGraphqlSchema, OperationType } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import type { FieldsBuilder } from "./fields-builder";

/**
 * Brand key for CompatSpec to distinguish from other GqlDefine values.
 * Using a string literal brand instead of unique symbol for cross-file compatibility.
 */
export const COMPAT_SPEC_BRAND = "__compat_spec__" as const;

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
 *   __compat_spec__: true,
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
  TVarDefinitions extends InputTypeSpecifiers,
  TFields extends AnyFields,
> = {
  readonly [COMPAT_SPEC_BRAND]: true;
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
export type AnyCompatSpec = CompatSpec<AnyGraphqlSchema, OperationType, string, InputTypeSpecifiers, AnyFields>;

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
