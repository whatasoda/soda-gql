export { define, defineOperationRoots, defineScalar } from "./builder/schema";
export { unsafeInputRef, unsafeOutputRef } from "./builder/type-ref";
export type { CreateGqlConfig, GqlInstance } from "./factories/create-gql";
export { createGqlSingle } from "./factories/create-gql";
export { createGql } from "./factories/multi-schema";
export * from "./types";
export type { GqlFactory, MultiSchemaConfig, SchemaConfig, SchemaInvoker } from "./types/multi-schema";
