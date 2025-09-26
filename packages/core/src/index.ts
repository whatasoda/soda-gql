import { createModelFactory } from "./builder/model";
import { createOperationFactory } from "./builder/operation";
import { createOperationSliceFactory } from "./builder/operation-slice";
import { createGqlHelpers } from "./builder/schema";
import type { AnyGraphqlSchema, GraphqlRuntimeAdapter } from "./types";

export { define, defineOperationRoots, defineScalar } from "./builder/schema";
export { unsafeInputRef, unsafeOutputRef } from "./builder/type-ref";
export * from "./types";

export type CreateGqlConfig<TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends GraphqlRuntimeAdapter> = {
  readonly schema: TSchema;
  readonly adapter: TRuntimeAdapter;
};

export const createGql = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends GraphqlRuntimeAdapter>({
  schema,
  adapter,
}: CreateGqlConfig<TSchema, TRuntimeAdapter>) => {
  const helpers = createGqlHelpers(schema);
  const model = createModelFactory(schema);
  const sliceFactory = createOperationSliceFactory<TSchema, TRuntimeAdapter>(schema, adapter);
  const operationFactory = createOperationFactory<TSchema, TRuntimeAdapter>(schema, adapter);

  return {
    ...helpers,
    model,
    querySlice: sliceFactory("query"),
    mutationSlice: sliceFactory("mutation"),
    subscriptionSlice: sliceFactory("subscription"),
    query: operationFactory("query"),
    mutation: operationFactory("mutation"),
    subscription: operationFactory("subscription"),
    adapter,
  };
};
