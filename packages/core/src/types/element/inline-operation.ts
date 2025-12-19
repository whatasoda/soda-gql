import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { Hidden } from "../../utils/hidden";
import type { AnyFields, InferFields } from "../fragment";
import type { OperationMetadata } from "../metadata";
import type { AnyConstAssignableInput, AnyGraphqlSchema, ConstAssignableInput, OperationType } from "../schema";
import type { InputTypeSpecifiers } from "../type-foundation";
import { GqlElement, type GqlElementContext } from "./gql-element";

export type AnyInlineOperation =
  | AnyInlineOperationOf<"query">
  | AnyInlineOperationOf<"mutation">
  | AnyInlineOperationOf<"subscription">;
export type AnyInlineOperationOf<TOperationType extends OperationType> = InlineOperation<
  TOperationType,
  string,
  string[],
  any,
  AnyFields,
  any
>;

export type InlineOperationInferMeta<TVariables, TData extends object> = {
  readonly input: TVariables;
  readonly output: TData;
};

declare const __INLINE_OPERATION_BRAND__: unique symbol;

type InlineOperationArtifact<
  TOperationType extends OperationType,
  TOperationName extends string,
  TVariableNames extends string[],
  TVariables extends AnyConstAssignableInput,
  TFields extends Partial<AnyFields>,
  TData extends object,
> = {
  readonly operationType: TOperationType;
  readonly operationName: TOperationName;
  readonly variableNames: TVariableNames;
  readonly documentSource: () => TFields;
  readonly document: TypedDocumentNode<TData, TVariables>;
  readonly metadata?: OperationMetadata;
};

export class InlineOperation<
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableNames extends string[],
    TVariables extends AnyConstAssignableInput,
    TFields extends Partial<AnyFields>,
    TData extends object,
  >
  extends GqlElement<
    InlineOperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>,
    InlineOperationInferMeta<TVariables, TData>
  >
  implements InlineOperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>
{
  declare readonly [__INLINE_OPERATION_BRAND__]: Hidden<{
    operationType: TOperationType;
  }>;

  private constructor(
    define: (
      context: GqlElementContext | null,
    ) =>
      | InlineOperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>
      | Promise<InlineOperationArtifact<TOperationType, TOperationName, TVariableNames, TVariables, TFields, TData>>,
  ) {
    super(define);
  }

  public get operationType() {
    return GqlElement.get(this).operationType;
  }
  public get operationName() {
    return GqlElement.get(this).operationName;
  }
  public get variableNames() {
    return GqlElement.get(this).variableNames;
  }
  public get documentSource() {
    return GqlElement.get(this).documentSource;
  }
  public get document() {
    return GqlElement.get(this).document;
  }
  public get metadata() {
    return GqlElement.get(this).metadata;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TFields extends AnyFields,
  >(
    define: (context: GqlElementContext | null) =>
      | {
          operationType: TOperationType;
          operationName: TOperationName;
          variableNames: (keyof TVariableDefinitions & string)[];
          documentSource: () => TFields;
          document: TypedDocumentNode<InferFields<TSchema, TFields>, ConstAssignableInput<TSchema, TVariableDefinitions>>;
          metadata?: OperationMetadata;
        }
      | Promise<{
          operationType: TOperationType;
          operationName: TOperationName;
          variableNames: (keyof TVariableDefinitions & string)[];
          documentSource: () => TFields;
          document: TypedDocumentNode<InferFields<TSchema, TFields>, ConstAssignableInput<TSchema, TVariableDefinitions>>;
          metadata?: OperationMetadata;
        }>,
  ) {
    return new InlineOperation(define);
  }
}
