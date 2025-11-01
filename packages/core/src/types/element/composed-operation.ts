/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { Hidden } from "../../utils/hidden";
import type { Prettify } from "../../utils/prettify";
import type { UnionToIntersection } from "../../utils/type-utils";
import type { AnyFields, AssignableInput, InferFields } from "../fragment";
import type { SodaGqlSchemaRegistry } from "../registry";
import type { AnyGraphqlRuntimeAdapter, InferExecutionResultProjection, NormalizedExecutionResult } from "../runtime";
import type { AnyConstAssignableInput, ConstAssignableInput, InputTypeSpecifiers, OperationType } from "../schema";
import { GqlElement, type GqlElementContext } from "./gql-element";
import type { AnySlicePayloads } from "./slice";

export type AnyComposedOperation =
  | AnyComposedOperationOf<"query">
  | AnyComposedOperationOf<"mutation">
  | AnyComposedOperationOf<"subscription">;
export type AnyComposedOperationOf<TOperationType extends OperationType> = ComposedOperation<
  AnyGraphqlRuntimeAdapter,
  TOperationType,
  string,
  string[],
  any,
  any,
  any
>;

declare const __COMPOSED_OPERATION_BRAND__: unique symbol;

type ComposedOperationDefinition<
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
  readonly document: TypedDocumentNode<TRawData, TVariables>;
  readonly parse: (result: NormalizedExecutionResult<TRuntimeAdapter, TRawData, any>) => TProjectedData;
};

export class ComposedOperation<
    TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableNames extends string[],
    TVariables extends AnyConstAssignableInput,
    TRawData extends object,
    TProjectedData extends object,
  >
  extends GqlElement<
    ComposedOperationDefinition<
      TRuntimeAdapter,
      TOperationType,
      TOperationName,
      TVariableNames,
      TVariables,
      TRawData,
      TProjectedData
    >
  >
  implements
    ComposedOperationDefinition<
      TRuntimeAdapter,
      TOperationType,
      TOperationName,
      TVariableNames,
      TVariables,
      TRawData,
      TProjectedData
    >
{
  declare readonly [__COMPOSED_OPERATION_BRAND__]: Hidden<{
    operationType: TOperationType;
  }>;

  private constructor(
    define: (
      context: GqlElementContext | null,
    ) => ComposedOperationDefinition<
      TRuntimeAdapter,
      TOperationType,
      TOperationName,
      TVariableNames,
      TVariables,
      TRawData,
      TProjectedData
    >,
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
  public get projectionPathGraph() {
    return GqlElement.get(this).projectionPathGraph;
  }
  public get document() {
    return GqlElement.get(this).document;
  }
  public get parse() {
    return GqlElement.get(this).parse;
  }

  static create<
    TSchemaKey extends keyof SodaGqlSchemaRegistry,
    TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
    TOperationType extends OperationType,
    TOperationName extends string,
    TVariableDefinitions extends InputTypeSpecifiers,
    TSliceFragments extends AnySlicePayloads,
  >(
    define: (context: import("./gql-element").GqlElementContext | null) => {
      operationType: TOperationType;
      operationName: TOperationName;
      variableNames: (keyof TVariableDefinitions & string)[];
      projectionPathGraph: ProjectionPathGraphNode;
      document: TypedDocumentNode<
        InferComposedOperationRawData<TSchemaKey, TSliceFragments>,
        ConstAssignableInput<TSchemaKey, TVariableDefinitions>
      >;
      parse: (
        result: NormalizedExecutionResult<
          TRuntimeAdapter,
          InferComposedOperationRawData<TSchemaKey, TSliceFragments>,
          any
        >,
      ) => {
        [K in keyof TSliceFragments]: InferExecutionResultProjection<TSliceFragments[K]["projection"]>;
      };
    },
  ) {
    return new ComposedOperation(define);
  }
}

export type ProjectionPathGraphNode = {
  readonly matches: { label: string; path: string; exact: boolean }[];
  readonly children: { readonly [segment: string]: ProjectionPathGraphNode };
};

export type ConcatSlicePayloads<TSlicePayloads extends AnySlicePayloads> = Prettify<
  UnionToIntersection<
    {
      [TLabel in keyof TSlicePayloads & string]: TSlicePayloads[TLabel] extends { getFields: () => infer TFields }
        ? { [K in keyof TFields & string as `${TLabel}_${K}`]: TFields[K] }
        : {};
    }[keyof TSlicePayloads & string]
  >
> &
  AnyFields;

export type InferComposedOperationRawData<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TSlicePayloads extends AnySlicePayloads,
> = Prettify<InferFields<TSchemaKey, ConcatSlicePayloads<TSlicePayloads>>>;

export type ComposedOperationDefinitionBuilder<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TVarDefinitions extends InputTypeSpecifiers,
  TSliceContents extends AnySlicePayloads,
> = (tools: { $: NoInfer<AssignableInput<TSchemaKey, TVarDefinitions>> }) => TSliceContents;
