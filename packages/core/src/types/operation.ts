/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */
import type { ExecutionResult, TypedQueryDocumentNode } from "graphql";
import type { GraphqlAdapter } from "./adapter";
import type { InferField } from "./fields";
import type { AssignableConstInput, AssignableInput } from "./input-value";
import type { AnyOperationSlice } from "./operation-slice";
import type { AnyGraphqlSchema, OperationType } from "./schema";
import type { InputTypeRefs } from "./type-ref";
import type { EmptyObject, Hidden, Prettify, UnionToIntersection } from "./utility";

/**
 * Top-level operation builder that stitches multiple slices together and keeps
 * the resulting GraphQL document plus composite transform typed end-to-end.
 */
export type OperationFn<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
> = <
  TName extends string,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TAdapter, TOperationType> },
  TVariableDefinitions extends InputTypeRefs = EmptyObject,
>(
  name: TName,
  variables: TVariableDefinitions | null,
  builder: OperationBuilder<TSchema, TAdapter, TOperationType, TVariableDefinitions, TSlices>,
) => Operation<TSchema, TAdapter, TOperationType, TName, TVariableDefinitions, TSlices>;

export type Operation<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
  TName extends string,
  TVariableDefinitions extends InputTypeRefs,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TAdapter, TOperationType> },
> = {
  _input: Hidden<AssignableConstInput<TSchema, TVariableDefinitions>>;
  _raw: Hidden<InferOperationRawData<TSchema, TAdapter, TOperationType, TSlices>>;
  _output: Hidden<{
    [K in keyof TSlices]: ReturnType<TSlices[K]["_output"]>;
  }>;
  type: TOperationType;
  name: TName;
  document: TypedQueryDocumentNode<
    InferOperationRawData<TSchema, TAdapter, TOperationType, TSlices>,
    AssignableConstInput<TSchema, TVariableDefinitions>
  >;
  parse: (result: ExecutionResult<InferOperationRawData<TSchema, TAdapter, TOperationType, TSlices>>) => {
    [K in keyof TSlices]: ReturnType<TSlices[K]["_output"]>;
  };
};

type InferOperationRawData<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TAdapter, TOperationType> },
> = Prettify<
  UnionToIntersection<
    {
      [TLabel in keyof TSlices & string]: {
        [K in keyof TSlices[TLabel]["fields"] & string as `${TLabel}_${K}`]: InferField<TSchema, TSlices[TLabel]["fields"][K]>;
      };
    }[keyof TSlices & string]
  >
>;

/** Builder invoked from userland to wire slices with operation-level variables. */
export type OperationBuilder<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperationType extends OperationType,
  TVariables extends InputTypeRefs,
  TSlices extends { [key: string]: AnyOperationSlice<TSchema, TAdapter, TOperationType> },
> = (tools: { $: NoInfer<AssignableInput<TSchema, TVariables>> }) => TSlices;
