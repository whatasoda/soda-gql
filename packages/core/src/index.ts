import { createModelFactory } from "./model";
import { createOperationFactory } from "./operation";
import { createOperationSliceFactory } from "./operation-slice";
import { createGqlHelpers } from "./schema";
import type { GraphqlAdapter } from "./types/adapter";
import type { AnyGraphqlSchema } from "./types/schema";

export { define, defineOperationTypeNames, type } from "./schema";
export { unsafeInputRef, unsafeOutputRef } from "./type-ref";
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
