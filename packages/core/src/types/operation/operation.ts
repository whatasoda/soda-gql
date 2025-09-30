/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */
import type { TypedQueryDocumentNode } from "graphql";
import type { AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlRuntimeAdapter, InferExecutionResultProjection, NormalizedExecutionResult } from "../runtime";
import type { AnyConstAssignableInput, AnyGraphqlSchema, ConstAssignableInput, InputTypeRefs, OperationType } from "../schema";
import type { Prettify, PseudoTypeAnnotation, UnionToIntersection } from "../shared/utility";
import type { AnyOperationSliceFragments } from "./operation-slice";

export type AnyOperation<TOperationType extends OperationType> = Operation<
  AnyGraphqlRuntimeAdapter,
  TOperationType,
  string,
  string[],
  any,
  any,
  any
>;

declare const __OPERATION_BRAND__: unique symbol;

export class Operation<
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVariableNames extends string[],
  TVariables extends AnyConstAssignableInput,
  TRawData extends object,
  TProjectedData extends object,
> {
  declare readonly [__OPERATION_BRAND__]: PseudoTypeAnnotation<{
    operationType: TOperationType;
  }>;

  private constructor(
    public readonly operationType: TOperationType,
    public readonly operationName: TOperationName,
    public readonly variableNames: TVariableNames,
    public readonly projectionPathGraph: ExecutionResultProjectionPathGraphNode,
    public readonly document: TypedQueryDocumentNode<TRawData, TVariables>,
    public readonly parse: (result: NormalizedExecutionResult<TRuntimeAdapter, TRawData, any>) => TProjectedData,
  ) {}

  static create<
    TSchema extends AnyGraphqlSchema,
    TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableDefinitions extends InputTypeRefs,
    TSliceFragments extends AnyOperationSliceFragments,
  >({
    operationType,
    operationName,
    variableNames,
    projectionPathGraph,
    document,
    parse,
  }: {
    operationType: TOperationType;
    operationName: TOperationName;
    variableNames: (keyof TVariableDefinitions & string)[];
    projectionPathGraph: ExecutionResultProjectionPathGraphNode;
    document: TypedQueryDocumentNode<
      InferOperationRawData<TSchema, TSliceFragments>,
      ConstAssignableInput<TSchema, TVariableDefinitions>
    >;
    parse: (result: NormalizedExecutionResult<TRuntimeAdapter, InferOperationRawData<TSchema, TSliceFragments>, any>) => {
      [K in keyof TSliceFragments]: InferExecutionResultProjection<TSliceFragments[K]["projection"]>;
    };
  }) {
    return new Operation(operationType, operationName, variableNames, projectionPathGraph, document, parse);
  }
}

export type ExecutionResultProjectionPathGraphNode = {
  readonly matches: { label: string; path: string; exact: boolean }[];
  readonly children: { readonly [segment: string]: ExecutionResultProjectionPathGraphNode };
};

export type ConcatSliceFragments<TSliceFragments extends AnyOperationSliceFragments> = Prettify<
  UnionToIntersection<
    {
      [TLabel in keyof TSliceFragments & string]: TSliceFragments[TLabel] extends { getFields: () => infer TFields }
        ? { [K in keyof TFields & string as `${TLabel}_${K}`]: TFields[K] }
        : {};
    }[keyof TSliceFragments & string]
  >
> &
  AnyFields;

export type InferOperationRawData<
  TSchema extends AnyGraphqlSchema,
  TSliceFragments extends AnyOperationSliceFragments,
> = Prettify<InferFields<TSchema, ConcatSliceFragments<TSliceFragments>>>;

/** Builder invoked from userland to wire slices with operation-level variables. */
export type OperationBuilder<
  TSchema extends AnyGraphqlSchema,
  TVarDefinitions extends InputTypeRefs,
  TSlices extends AnyOperationSliceFragments,
> = (tools: { $: NoInfer<AssignableInput<TSchema, TVarDefinitions>> }) => TSlices;
