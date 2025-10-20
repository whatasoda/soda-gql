/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */
import type { TypedQueryDocumentNode } from "graphql";
import type { Hidden } from "../../utils/hidden";
import type { Prettify } from "../../utils/prettify";
import type { UnionToIntersection } from "../../utils/type-utils";
import type { AnyFields, AssignableInput, InferFields } from "../fragment";
import type { AnyGraphqlRuntimeAdapter, InferExecutionResultProjection, NormalizedExecutionResult } from "../runtime";
import type {
  AnyConstAssignableInput,
  AnyGraphqlSchema,
  ConstAssignableInput,
  InputTypeSpecifiers,
  OperationType,
} from "../schema";
import { ComposerElement } from "./artifact-element";
import type { AnySliceContents } from "./slice";

export type AnyOperation = AnyOperationOf<"query"> | AnyOperationOf<"mutation"> | AnyOperationOf<"subscription">;
export type AnyOperationOf<TOperationType extends OperationType> = Operation<
  AnyGraphqlRuntimeAdapter,
  TOperationType,
  string,
  string[],
  any,
  any,
  any
>;

declare const __OPERATION_BRAND__: unique symbol;

type OperationArtifact<
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
  readonly projectionPathGraph: ProjectionPathGraphNode;
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
  extends ComposerElement<
    OperationArtifact<TRuntimeAdapter, TOperationType, TOperationName, TVariableNames, TVariables, TRawData, TProjectedData>
  >
  implements
    OperationArtifact<TRuntimeAdapter, TOperationType, TOperationName, TVariableNames, TVariables, TRawData, TProjectedData>
{
  declare readonly [__OPERATION_BRAND__]: Hidden<{
    operationType: TOperationType;
  }>;

  private constructor(
    factory: (
      context: import("./artifact-element").ComposerContext | null,
    ) => OperationArtifact<TRuntimeAdapter, TOperationType, TOperationName, TVariableNames, TVariables, TRawData, TProjectedData>,
  ) {
    super(factory);
  }

  public get operationType() {
    return ComposerElement.get(this).operationType;
  }
  public get operationName() {
    return ComposerElement.get(this).operationName;
  }
  public get variableNames() {
    return ComposerElement.get(this).variableNames;
  }
  public get projectionPathGraph() {
    return ComposerElement.get(this).projectionPathGraph;
  }
  public get document() {
    return ComposerElement.get(this).document;
  }
  public get parse() {
    return ComposerElement.get(this).parse;
  }

  static create<
    TSchema extends AnyGraphqlSchema,
    TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TSliceFragments extends AnySliceContents,
  >(
    factory: (context: import("./artifact-element").ComposerContext | null) => {
      operationType: TOperationType;
      operationName: TOperationName;
      variableNames: (keyof TVariableDefinitions & string)[];
      projectionPathGraph: ProjectionPathGraphNode;
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

export type ProjectionPathGraphNode = {
  readonly matches: { label: string; path: string; exact: boolean }[];
  readonly children: { readonly [segment: string]: ProjectionPathGraphNode };
};

export type ConcatSliceContents<TSliceContents extends AnySliceContents> = Prettify<
  UnionToIntersection<
    {
      [TLabel in keyof TSliceContents & string]: TSliceContents[TLabel] extends { getFields: () => infer TFields }
        ? { [K in keyof TFields & string as `${TLabel}_${K}`]: TFields[K] }
        : {};
    }[keyof TSliceContents & string]
  >
> &
  AnyFields;

export type InferOperationRawData<TSchema extends AnyGraphqlSchema, TSliceContents extends AnySliceContents> = Prettify<
  InferFields<TSchema, ConcatSliceContents<TSliceContents>>
>;

/** Builder invoked from userland to wire slices with operation-level variables. */
export type OperationDefinitionBuilder<
  TSchema extends AnyGraphqlSchema,
  TVarDefinitions extends InputTypeSpecifiers,
  TSliceContents extends AnySliceContents,
> = (tools: { $: NoInfer<AssignableInput<TSchema, TVarDefinitions>> }) => TSliceContents;
