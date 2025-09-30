/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */
import type { TypedQueryDocumentNode } from "graphql";
import type { AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlRuntimeAdapter, InferExecutionResultProjection, NormalizedExecutionResult } from "../runtime";
import type { AnyConstAssignableInput, AnyGraphqlSchema, ConstAssignableInput, InputTypeRefs, OperationType } from "../schema";
import { DeferredInstance } from "../shared/deferred-instance";
import type { Hidden } from "../shared/hidden";
import type { Prettify } from "../shared/prettify";
import type { UnionToIntersection } from "../shared/utility";
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

type OperationInner<
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TOperationName extends string,
  TVariableNames extends string[],
  TVariables extends AnyConstAssignableInput,
  TRawData extends object,
  TProjectedData extends object,
> = {
  readonly operationType: TOperationType;
  readonly operationName: TOperationName;
  readonly variableNames: TVariableNames;
  readonly projectionPathGraph: ExecutionResultProjectionPathGraphNode;
  readonly document: TypedQueryDocumentNode<TRawData, TVariables>;
  readonly parse: (result: NormalizedExecutionResult<TRuntimeAdapter, TRawData, any>) => TProjectedData;
};

export class Operation<
    TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableNames extends string[],
    TVariables extends AnyConstAssignableInput,
    TRawData extends object,
    TProjectedData extends object,
  >
  extends DeferredInstance<
    OperationInner<TRuntimeAdapter, TOperationType, TOperationName, TVariableNames, TVariables, TRawData, TProjectedData>
  >
  implements OperationInner<TRuntimeAdapter, TOperationType, TOperationName, TVariableNames, TVariables, TRawData, TProjectedData>
{
  declare readonly [__OPERATION_BRAND__]: Hidden<{
    operationType: TOperationType;
  }>;

  private constructor(
    factory: () => OperationInner<
      TRuntimeAdapter,
      TOperationType,
      TOperationName,
      TVariableNames,
      TVariables,
      TRawData,
      TProjectedData
    >,
  ) {
    super(factory);
  }

  public get operationType() {
    return DeferredInstance.get(this).operationType;
  }
  public get operationName() {
    return DeferredInstance.get(this).operationName;
  }
  public get variableNames() {
    return DeferredInstance.get(this).variableNames;
  }
  public get projectionPathGraph() {
    return DeferredInstance.get(this).projectionPathGraph;
  }
  public get document() {
    return DeferredInstance.get(this).document;
  }
  public get parse() {
    return DeferredInstance.get(this).parse;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableDefinitions extends InputTypeRefs,
    TSliceFragments extends AnyOperationSliceFragments,
  >(
    factory: () => {
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
    },
  ) {
    return new Operation(factory);
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
