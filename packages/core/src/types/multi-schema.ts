import type { GraphqlRuntimeAdapter } from "./adapter";
import type { AnyGraphqlSchema } from "./schema";

export type SchemaConfig<TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends GraphqlRuntimeAdapter> = {
  readonly schema: TSchema;
  readonly adapter: TRuntimeAdapter;
};

export type MultiSchemaConfig<TConfigs extends Record<string, SchemaConfig<AnyGraphqlSchema, GraphqlRuntimeAdapter>>> = {
  readonly [TSchemaName in keyof TConfigs]: TConfigs[TSchemaName];
};

export type SchemaInvoker<THelpers> = <TResult>(factory: (helpers: THelpers) => TResult) => TResult;

export type GqlFactory<TInstances extends Record<string, unknown>> = {
  readonly [TSchemaName in keyof TInstances]: SchemaInvoker<TInstances[TSchemaName]>;
};
