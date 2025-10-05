import type { AnyModel, AnyOperation, AnySlice } from "../types/operation";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema } from "../types/schema";
import { createGqlModels } from "./model";
import { createOperationFactory } from "./operation";
import { createSliceFactory } from "./slice";
import { createVarBuilder } from "./var-builder";

export type GqlInvoker<TBuilder, THelper> = <TResult extends AnyModel | AnySlice | AnyOperation>(
  factory: (builder: TBuilder, helper: THelper) => TResult,
) => TResult;

export const createGqlInvoker = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>(
  schema: NoInfer<TSchema>,
) => {
  const model = createGqlModels<TSchema>(schema);
  const sliceFactory = createSliceFactory<TSchema, TRuntimeAdapter>(schema);
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
