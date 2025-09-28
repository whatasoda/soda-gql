import type { AnyGraphqlSchema, GraphqlRuntimeAdapter } from "../types";
import type { GqlFactory, MultiSchemaConfig, SchemaConfig } from "../types/multi-schema";
import type { GqlInstance } from "./create-gql";
import { createGqlSingle } from "./create-gql";

/** Maps schema configuration entries to their corresponding gql helper bundle. */
type SchemaInstances<TConfigs extends MultiSchemaConfig<Record<string, SchemaConfig<AnyGraphqlSchema, GraphqlRuntimeAdapter>>>> =
  {
    readonly [TSchemaName in keyof TConfigs]: SchemaConfigToInstance<TConfigs[TSchemaName]>;
  };

type SchemaConfigToInstance<TConfig> = TConfig extends SchemaConfig<infer TSchema, infer TRuntimeAdapter>
  ? GqlInstance<TSchema, TRuntimeAdapter>
  : never;

export const createGql = <
  TConfigs extends MultiSchemaConfig<Record<string, SchemaConfig<AnyGraphqlSchema, GraphqlRuntimeAdapter>>>,
>(
  configs: TConfigs,
): GqlFactory<SchemaInstances<TConfigs>> => {
  const invokers: Partial<GqlFactory<SchemaInstances<TConfigs>>> = {};
  const schemaNames = Object.keys(configs) as Array<keyof TConfigs & string>;

  for (const schemaName of schemaNames) {
    assignInvoker(schemaName, configs[schemaName]);
  }

  return invokers as GqlFactory<SchemaInstances<TConfigs>>;

  function assignInvoker<TSchemaName extends keyof TConfigs & string>(schemaName: TSchemaName, config: TConfigs[TSchemaName]) {
    const helpers = createGqlSingle(config) as SchemaConfigToInstance<TConfigs[TSchemaName]>;;

    invokers[schemaName] = ((factory) => factory(helpers)) as GqlFactory<SchemaInstances<TConfigs>>[TSchemaName];
  }
};
