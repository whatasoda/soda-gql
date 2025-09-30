import type { AnyModel, AnyOperation, AnyOperationSlice } from "../types/operation";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, OperationType } from "../types/schema";
import { createModelFactory } from "./model";
import { createOperationFactory } from "./operation";
import { createOperationSliceFactory } from "./operation-slice";
import { createVarBuilder } from "./var-builder";

type AcceptableInvokerResult = OperationType extends infer TOperationType extends OperationType
  ? TOperationType extends OperationType
    ? AnyModel | AnyOperation<TOperationType> | AnyOperationSlice<TOperationType>
    : never
  : never;

export type GqlInvoker<TBuilder, THelper> = <TResult extends AcceptableInvokerResult>(
  factory: (builder: TBuilder, helper: THelper) => TResult,
) => TResult;

export const createGqlInvoker = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  schema: NoInfer<TSchema>,
) => {
  const model = createModelFactory<TSchema>(schema);
  const sliceFactory = createOperationSliceFactory<TSchema, TRuntimeAdapter>(schema);
  const operationFactory = createOperationFactory<TSchema, TRuntimeAdapter>();
  const builder = {
    model,
    slice: {
      query: sliceFactory("query"),
      mutation: sliceFactory("mutation"),
      subscription: sliceFactory("subscription"),
    },
    operation: {
      query: operationFactory("query"),
      mutation: operationFactory("mutation"),
      subscription: operationFactory("subscription"),
    },
  };

  const helper = {
    ...createVarBuilder(schema),
  };

  const invoker: GqlInvoker<typeof builder, typeof helper> = (factory) => factory(builder, helper);

  return invoker;
};
