import {
  type AnyGraphqlSchema,
  createGqlInvoker,
  define,
  defineOperationRoots,
  unsafeInputRef,
  unsafeOutputRef,
} from "@soda-gql/core";
import { createRuntimeAdapter } from "@soda-gql/runtime";
import { adapter as adapter_default } from "../inject-module/runtime-adapter";
import { scalar as scalar_default } from "../inject-module/runtime-adapter";


const defaultSchema = {
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: scalar_default,
  enum: {},
  input: {},
  object: {
    Mutation: define("Mutation").object({
      createUser: unsafeOutputRef.object("User:!", { arguments: {
        email: unsafeInputRef.scalar("String:!", { default: null, directives: {} }),
        name: unsafeInputRef.scalar("String:!", { default: null, directives: {} }),
      }, directives: {} }),
      updateUser: unsafeOutputRef.object("User:?", { arguments: {
        id: unsafeInputRef.scalar("ID:!", { default: null, directives: {} }),
        name: unsafeInputRef.scalar("String:!", { default: null, directives: {} }),
      }, directives: {} }),
    }, {}),
    Post: define("Post").object({
      author: unsafeOutputRef.object("User:!", { arguments: {}, directives: {} }),
      content: unsafeOutputRef.scalar("String:!", { arguments: {}, directives: {} }),
      id: unsafeOutputRef.scalar("ID:!", { arguments: {}, directives: {} }),
      title: unsafeOutputRef.scalar("String:!", { arguments: {}, directives: {} }),
    }, {}),
    Query: define("Query").object({
      user: unsafeOutputRef.object("User:?", { arguments: {
        id: unsafeInputRef.scalar("ID:!", { default: null, directives: {} }),
      }, directives: {} }),
      users: unsafeOutputRef.object("User:![]!", { arguments: {}, directives: {} }),
    }, {}),
    User: define("User").object({
      email: unsafeOutputRef.scalar("String:!", { arguments: {}, directives: {} }),
      id: unsafeOutputRef.scalar("ID:!", { arguments: {}, directives: {} }),
      name: unsafeOutputRef.scalar("String:!", { arguments: {}, directives: {} }),
      posts: unsafeOutputRef.object("Post:![]!", { arguments: {}, directives: {} }),
    }, {}),
  },
  union: {},
} satisfies AnyGraphqlSchema;

export type Schema_default = typeof defaultSchema & { _?: never };
export type Adapter_default = typeof adapter_default & { _?: never };

export const gql = {
  default: createGqlInvoker<Schema_default, Adapter_default>(defaultSchema)
};
