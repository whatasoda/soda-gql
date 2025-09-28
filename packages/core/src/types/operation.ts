/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */
import type { TypedQueryDocumentNode } from "graphql";
import type { GraphqlRuntimeAdapter } from "./adapter";
import type { NormalizedExecutionResult } from "./execution-result";
import type { InferField } from "./fields";
import type { AssignableConstInput, AssignableInput } from "./input-value";
import type { AnyOperationSlice } from "./operation-slice";
import type { AnyGraphqlSchema, OperationType } from "./schema";
import type { InputTypeRefs } from "./type-ref";
import type { EmptyObject, Prettify, PseudoTypeAnnotation, UnionToIntersection } from "./utility";

/**
 * Top-level operation builder that stitches multiple slices together and keeps
 * the resulting GraphQL document plus composite transform typed end-to-end.
 */
export type OperationFn<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
> = <
  TName extends string,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TRuntimeAdapter, TOperationType> },
  TVariableDefinitions extends InputTypeRefs = EmptyObject,
>(
  name: TName,
  variables: TVariableDefinitions | null,
  builder: OperationBuilder<TSchema, TRuntimeAdapter, TOperationType, TVariableDefinitions, TSlices>,
) => Operation<TSchema, TRuntimeAdapter, TOperationType, TName, TVariableDefinitions, TSlices>;

export type Operation<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TName extends string,
  TVariableDefinitions extends InputTypeRefs,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TRuntimeAdapter, TOperationType> },
> = {
  _metadata: PseudoTypeAnnotation<{ type: TOperationType }>;
  _input: PseudoTypeAnnotation<AssignableConstInput<TSchema, TVariableDefinitions>>;
  _raw: PseudoTypeAnnotation<InferOperationRawData<TSchema, TRuntimeAdapter, TOperationType, TSlices>>;
  _output: PseudoTypeAnnotation<{
    [K in keyof TSlices]: ReturnType<TSlices[K]["_output"]>;
  }>;
  name: TName;
  variableNames: (keyof TVariableDefinitions & string)[];
  projectionPathGraph: ExecutionResultProjectionPathGraphNode;
  document: TypedQueryDocumentNode<
    InferOperationRawData<TSchema, TRuntimeAdapter, TOperationType, TSlices>,
    AssignableConstInput<TSchema, TVariableDefinitions>
  >;
  parse: (
    result: NormalizedExecutionResult<
      TRuntimeAdapter,
      InferOperationRawData<TSchema, TRuntimeAdapter, TOperationType, TSlices>,
      // biome-ignore lint/suspicious/noExplicitAny: abstract type
      any
    >,
  ) => {
    [K in keyof TSlices]: ReturnType<TSlices[K]["_output"]>;
  };
};

export type ExecutionResultProjectionPathGraphNode = {
  readonly matches: { label: string; path: string; exact: boolean }[];
  readonly children: { readonly [segment: string]: ExecutionResultProjectionPathGraphNode };
};

type InferOperationRawData<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TRuntimeAdapter, TOperationType> },
> = Prettify<
  UnionToIntersection<
    {
      [TLabel in keyof TSlices & string]: {
        [K in keyof ReturnType<TSlices[TLabel]["getFields"]> & string as `${TLabel}_${K}`]: InferField<
          TSchema,
          ReturnType<TSlices[TLabel]["getFields"]>[K]
        >;
      };
    }[keyof TSlices & string]
  >
>;

/** Builder invoked from userland to wire slices with operation-level variables. */
export type OperationBuilder<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
  TVariables extends InputTypeRefs,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TRuntimeAdapter, TOperationType> },
> = (tools: { $: NoInfer<AssignableInput<TSchema, TVariables>> }) => TSlices;
