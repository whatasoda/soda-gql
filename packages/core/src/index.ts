import { createModelFactory } from "./builder/model";
import { createOperationFactory } from "./builder/operation";
import { createOperationSliceFactory } from "./builder/operation-slice";
import { createGqlHelpers } from "./builder/schema";
import type { AnyGraphqlSchema, GraphqlAdapter } from "./types";

export { define, defineOperationRoots, defineScalar } from "./builder/schema";
export { unsafeInputRef, unsafeOutputRef } from "./builder/type-ref";
export * from "./types";

export type CreateGqlConfig<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter> = {
  readonly schema: TSchema;
  readonly adapter: TAdapter;
};

export const createGql = <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>({
  schema,
  adapter,
}: CreateGqlConfig<TSchema, TAdapter>) => {
  const helpers = createGqlHelpers(schema);
  const model = createModelFactory(schema);
  const sliceFactory = createOperationSliceFactory(schema, adapter);
  const operationFactory = createOperationFactory(schema, adapter);

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
