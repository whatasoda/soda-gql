import { describe, expect, it } from "bun:test";
import {
  type AnyGraphqlRuntimeAdapter,
  type AnyGraphqlSchema,
  createGqlElementComposer,
  define,
  defineOperationRoots,
  defineScalar,
  unsafeInputType,
  unsafeOutputType,
} from "@soda-gql/core";
import { createRuntimeAdapter } from "@soda-gql/core/runtime";

const schema = {
  label: "test" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:!", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
      users: unsafeOutputType.object("User:![]!", {
        arguments: {
          categoryId: unsafeInputType.scalar("ID:?", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({
      updateUser: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
          name: unsafeInputType.scalar("String:!", {}),
        },
      }),
    }),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const adapter = createRuntimeAdapter(({ type }) => ({
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
})) satisfies AnyGraphqlRuntimeAdapter;

describe("metadata with variable access", () => {
  describe("inline operation", () => {
    it("metadata callback receives $ with variable refs", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.inline(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $ }) => ({
              extensions: {
                trackedVariables: [$var.getInner($.userId)],
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(() => [])],
        ),
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.extensions?.trackedVariables).toEqual([{ type: "variable", name: "userId" }]);
    });

    it("$var.getName extracts variable name", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.inline(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $ }) => ({
              custom: {
                variableNames: [$var.getName($.userId)],
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(() => [])],
        ),
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.custom?.variableNames).toEqual(["userId"]);
    });

    it("works with multiple variables", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const operation = gql(({ mutation }, { $var }) =>
        mutation.inline(
          {
            operationName: "UpdateUser",
            variables: [$var("userId").scalar("ID:!"), $var("userName").scalar("String:!")],
            metadata: ({ $ }) => ({
              extensions: {
                trackedVars: {
                  userId: $var.getName($.userId),
                  userName: $var.getName($.userName),
                },
              },
            }),
          },
          ({ f, $ }) => [f.updateUser({ id: $.userId, name: $.userName })(() => [])],
        ),
      );

      expect(operation.metadata?.extensions?.trackedVars).toEqual({
        userId: "userId",
        userName: "userName",
      });
    });

    it("metadata is undefined when not provided", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.inline(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
          },
          ({ f, $ }) => [f.user({ id: $.userId })(() => [])],
        ),
      );

      expect(operation.metadata).toBeUndefined();
    });
  });

  describe("composed operation", () => {
    it("metadata callback receives $ with variable refs", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }) =>
        query.slice(
          {},
          ({ f }) => [f.user({ id: "test-id" })(() => [])],
          ({ select }) => select(["$.user"], (user) => user),
        ),
      );

      const operation = gql(({ query }, { $var }) =>
        query.composed(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $ }) => ({
              headers: {
                "X-Variable-Name": $var.getName($.userId),
              },
            }),
          },
          () => ({
            user: userSlice.embed(),
          }),
        ),
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.headers?.["X-Variable-Name"]).toBe("userId");
    });
  });
});
