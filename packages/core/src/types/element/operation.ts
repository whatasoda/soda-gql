/**
 * Operation types for GraphQL queries, mutations, and subscriptions.
 * @module
 */

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { AnyFieldsExtended, InferFieldsExtended } from "../fragment";
import type { AnyConstAssignableInput, AnyGraphqlSchema, ConstAssignableInputFromVarDefs, OperationType } from "../schema";
import type { VariableDefinitions } from "../type-foundation";
import { GqlElement, type GqlElementContext } from "./gql-element";

/**
 * Type alias for any Operation instance.
 */
export type AnyOperation = AnyOperationOf<"query"> | AnyOperationOf<"mutation"> | AnyOperationOf<"subscription">;

/**
 * Type alias for an Operation of a specific type.
 */
export type AnyOperationOf<TOperationType extends OperationType> = Operation<
  TOperationType,
  string,
  string[],
  any,
  AnyFieldsExtended,
  any
>;

/**
 * Type inference metadata for operations.
 * Access via `typeof operation.$infer`.
 */
export type OperationInferMeta<TVariables, TData extends object> = {
  readonly input: TVariables;
  readonly output: TData;
};

declare const __OPERATION_BRAND__: unique symbol;

/**
 * Internal artifact shape produced by operation evaluation.
 * @internal
 */
type OperationArtifact<
  TOperationType extends OperationType,
  TOperationName extends string,
  TVariableNames extends string[],
  TVariables extends AnyConstAssignableInput,
  TFields extends Partial<AnyFieldsExtended>,
  TData extends object,
> = {
  readonly operationType: TOperationType;
  readonly operationName: TOperationName;
  readonly schemaLabel: string;
  readonly variableNames: TVariableNames;
  readonly documentSource: () => TFields;
  readonly document: TypedDocumentNode<TData, TVariables>;
  readonly metadata?: unknown;
};

/**
 * Represents a GraphQL operation (query, mutation, or subscription).
 *
 * Operations are created via `gql(({ query }) => query.operation({ ... }))`.
 * Produces a TypedDocumentNode for type-safe execution with GraphQL clients.
 *
 * @template TOperationType - 'query' | 'mutation' | 'subscription'
 * @template TOperationName - The unique operation name
 * @template TVariableNames - Tuple of variable names
 * @template TVariables - Variable types for the operation
 * @template TFields - Selected fields structure
 * @template TData - Inferred response data type
 */
export class Operation<
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableNames extends string[],
    TVariables extends AnyConstAssignableInput,
    TFields extends Partial<AnyFieldsExtended>,
    TData extends object,
  >
  extends GqlElement<
    OperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>,
    OperationInferMeta<TVariables, TData>
  >
  implements OperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>
{
  private declare readonly [__OPERATION_BRAND__]: void;

  private constructor(
    define: (
      context: GqlElementContext | null,
    ) =>
      | OperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>
      | Promise<OperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>>,
  ) {
    super(define);
  }

  /** The operation type: 'query', 'mutation', or 'subscription'. */
  public get operationType() {
    return GqlElement.get(this).operationType;
  }

  /** The unique name of this operation. */
  public get operationName() {
    return GqlElement.get(this).operationName;
  }

  /** The schema label this operation belongs to. */
  public get schemaLabel() {
    return GqlElement.get(this).schemaLabel;
  }

  /** List of variable names defined for this operation. */
  public get variableNames() {
    return GqlElement.get(this).variableNames;
  }

  /**
   * Returns the field selections. Used for document reconstruction.
   * @internal
   */
  public get documentSource() {
    return GqlElement.get(this).documentSource;
  }

  /** The TypedDocumentNode for use with GraphQL clients. */
  public get document() {
    return GqlElement.get(this).document;
  }

  /** Custom metadata attached to this operation, if any. */
  public get metadata() {
    return GqlElement.get(this).metadata;
  }

  /**
   * Creates a new Operation instance.
   * Prefer using the `gql(({ query }) => ...)` API instead.
   * @internal
   */
  static create<
    TSchema extends AnyGraphqlSchema,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableDefinitions extends VariableDefinitions,
    TFields extends AnyFieldsExtended,
  >(
    define: (context: GqlElementContext | null) =>
      | {
          operationType: TOperationType;
          operationName: TOperationName;
          schemaLabel: TSchema["label"];
          variableNames: (keyof TVariableDefinitions & string)[];
          documentSource: () => TFields;
          document: TypedDocumentNode<
            InferFieldsExtended<TSchema, TSchema["operations"][TOperationType] & keyof TSchema["object"] & string, TFields>,
            ConstAssignableInputFromVarDefs<TSchema, TVariableDefinitions>
          >;
          metadata?: unknown;
        }
      | Promise<{
          operationType: TOperationType;
          operationName: TOperationName;
          schemaLabel: TSchema["label"];
          variableNames: (keyof TVariableDefinitions & string)[];
          documentSource: () => TFields;
          document: TypedDocumentNode<
            InferFieldsExtended<TSchema, TSchema["operations"][TOperationType] & keyof TSchema["object"] & string, TFields>,
            ConstAssignableInputFromVarDefs<TSchema, TVariableDefinitions>
          >;
          metadata?: unknown;
        }>,
  ) {
    return new Operation(define);
  }
}
