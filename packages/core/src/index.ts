import { createModelFactory } from "./createGql/model";
import { createOperationFactory } from "./createGql/operation";
import { createOperationSliceFactory } from "./createGql/operation-slice";
import type { GraphqlAdapter } from "./types/adapter";
import type { AnyGraphqlSchema } from "./types/schema";
import { createHelpers } from "./types/schema";
import { createRefFactories } from "./types/type-ref";

export * from "./types";

export type CreateGqlConfig<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter> = {
  readonly schema: TSchema;
  readonly adapter: TAdapter;
};

export const createGql = <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>({
  schema,
  adapter,
}: CreateGqlConfig<TSchema, TAdapter>) => {
  const helpers = createHelpers(schema);
  const refs = createRefFactories<TSchema>();

  const model = createModelFactory(schema);
  const sliceFactory = createOperationSliceFactory(schema, adapter);
  const operationFactory = createOperationFactory(schema, adapter);

  return {
    ...helpers,
    ...refs,
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
