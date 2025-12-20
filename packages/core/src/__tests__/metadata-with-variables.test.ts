import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { print } from "graphql";
import { createGqlElementComposer } from "../composer/gql-composer";
import { createRuntimeAdapter } from "../runtime/runtime-adapter";
import {
  define,
  defineOperationRoots,
  defineScalar,
} from "../schema/schema-builder";
import {
  unsafeInputType,
  unsafeOutputType,
} from "../schema/type-specifier-builder";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema } from "../types/schema";

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
          ({ f, $ }) => [f.user({ id: $.userId })(() => [])]
        )
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.extensions?.trackedVariables).toEqual([
        { type: "variable", name: "userId" },
      ]);
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
          ({ f, $ }) => [f.user({ id: $.userId })(() => [])]
        )
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
            variables: [
              $var("userId").scalar("ID:!"),
              $var("userName").scalar("String:!"),
            ],
            metadata: ({ $ }) => ({
              extensions: {
                trackedVars: {
                  userId: $var.getName($.userId),
                  userName: $var.getName($.userName),
                },
              },
            }),
          },
          ({ f, $ }) => [
            f.updateUser({ id: $.userId, name: $.userName })(() => []),
          ]
        )
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
          ({ f, $ }) => [f.user({ id: $.userId })(() => [])]
        )
      );

      expect(operation.metadata).toBeUndefined();
    });

    it("metadata callback receives document as DocumentNode", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.inline(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ document }) => ({
              extensions: {
                documentHash: createHash("sha256")
                  .update(print(document))
                  .digest("hex"),
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])]
        )
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.extensions?.documentHash).toMatch(
        /^[a-f0-9]{64}$/
      );
    });

    it("metadata callback can access both $ and document", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.inline(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $, document }) => ({
              headers: {
                "X-Variable-Name": $var.getName($.userId),
              },
              extensions: {
                hasDocument: document.kind === "Document",
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])]
        )
      );

      expect(operation.metadata?.headers?.["X-Variable-Name"]).toBe("userId");
      expect(operation.metadata?.extensions?.hasDocument).toBe(true);
    });
  });

  describe("composed operation", () => {
    it("metadata callback receives $ with variable refs", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }) =>
        query.slice(
          {},
          ({ f }) => [f.user({ id: "test-id" })(() => [])],
          ({ select }) => select(["$.user"], (user) => user)
        )
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
          })
        )
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.headers?.["X-Variable-Name"]).toBe("userId");
    });

    it("metadata callback receives document as DocumentNode", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }) =>
        query.slice(
          {},
          ({ f }) => [f.user({ id: "test-id" })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      const operation = gql(({ query }, { $var }) =>
        query.composed(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ document }) => ({
              extensions: {
                documentHash: createHash("sha256")
                  .update(print(document))
                  .digest("hex"),
              },
            }),
          },
          () => ({
            user: userSlice.embed(),
          })
        )
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.extensions?.documentHash).toMatch(
        /^[a-f0-9]{64}$/
      );
    });

    it("metadata callback can access both $ and document", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }) =>
        query.slice(
          {},
          ({ f }) => [f.user({ id: "test-id" })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      const operation = gql(({ query }, { $var }) =>
        query.composed(
          {
            operationName: "GetUser",
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $, document }) => ({
              headers: {
                "X-Variable-Name": $var.getName($.userId),
              },
              extensions: {
                hasDocument: document.kind === "Document",
              },
            }),
          },
          () => ({
            user: userSlice.embed(),
          })
        )
      );

      expect(operation.metadata?.headers?.["X-Variable-Name"]).toBe("userId");
      expect(operation.metadata?.extensions?.hasDocument).toBe(true);
    });
  });

  describe("slice metadata factory", () => {
    it("metadata callback receives $ with variable assignments", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }, { $var }) =>
        query.slice(
          {
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $ }) => ({
              extensions: {
                trackedVariables: [$var.getInner($.userId)],
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      // Embed with a variable reference from operation
      const operation = gql(({ query }, { $var }) =>
        query.composed(
          {
            operationName: "GetUser",
            variables: [$var("opUserId").scalar("ID:!")],
          },
          ({ $ }) => ({
            user: userSlice.embed({ userId: $.opUserId }),
          })
        )
      );

      expect(operation.metadata).toBeDefined();
      expect(operation.metadata?.extensions?.trackedVariables).toEqual([
        { type: "variable", name: "opUserId" },
      ]);
    });

    it("metadata factory without variables still works", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }) =>
        query.slice(
          {
            metadata: () => ({
              custom: { requiresAuth: true, cacheTtl: 300 },
            }),
          },
          ({ f }) => [f.user({ id: "test-id" })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      const operation = gql(({ query }) =>
        query.composed(
          {
            operationName: "GetUser",
          },
          () => ({
            user: userSlice.embed(),
          })
        )
      );

      expect(operation.metadata?.custom?.requiresAuth).toBe(true);
      expect(operation.metadata?.custom?.cacheTtl).toBe(300);
    });

    it("metadata callback receives const value when embedded with literal", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }, { $var }) =>
        query.slice(
          {
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $ }) => ({
              custom: {
                varInner: $var.getInner($.userId),
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      const operation = gql(({ query }) =>
        query.composed(
          {
            operationName: "GetUser",
          },
          () => ({
            user: userSlice.embed({ userId: "literal-id" }),
          })
        )
      );

      expect(operation.metadata?.custom?.varInner).toEqual({
        type: "const-value",
        value: "literal-id",
      });
    });

    it("$var.getName extracts variable name from slice variables", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }, { $var }) =>
        query.slice(
          {
            variables: [$var("userId").scalar("ID:!")],
            metadata: ({ $ }) => ({
              headers: {
                "X-Slice-Variable": $var.getName($.userId),
              },
            }),
          },
          ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      const operation = gql(({ query }, { $var }) =>
        query.composed(
          {
            operationName: "GetUser",
            variables: [$var("opUserId").scalar("ID:!")],
          },
          ({ $ }) => ({
            user: userSlice.embed({ userId: $.opUserId }),
          })
        )
      );

      expect(operation.metadata?.headers?.["X-Slice-Variable"]).toBe(
        "opUserId"
      );
    });

    it("works with multiple slice variables", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ mutation }, { $var }) =>
        mutation.slice(
          {
            variables: [
              $var("id").scalar("ID:!"),
              $var("name").scalar("String:!"),
            ],
            metadata: ({ $ }) => ({
              extensions: {
                trackedVars: {
                  id: $var.getName($.id),
                  name: $var.getName($.name),
                },
              },
            }),
          },
          ({ f, $ }) => [
            f.updateUser({ id: $.id, name: $.name })(({ f }) => [f.id()]),
          ],
          ({ select }) => select(["$.updateUser"], (user) => user)
        )
      );

      const operation = gql(({ mutation }, { $var }) =>
        mutation.composed(
          {
            operationName: "UpdateUser",
            variables: [
              $var("userId").scalar("ID:!"),
              $var("userName").scalar("String:!"),
            ],
          },
          ({ $ }) => ({
            result: userSlice.embed({ id: $.userId, name: $.userName }),
          })
        )
      );

      expect(operation.metadata?.extensions?.trackedVars).toEqual({
        id: "userId",
        name: "userName",
      });
    });

    it("metadata is empty object when not provided", () => {
      const gql = createGqlElementComposer<Schema, typeof adapter>(schema);

      const userSlice = gql(({ query }, { $var }) =>
        query.slice(
          {
            variables: [$var("userId").scalar("ID:!")],
          },
          ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
          ({ select }) => select(["$.user"], (user) => user)
        )
      );

      const operation = gql(({ query }, { $var }) =>
        query.composed(
          {
            operationName: "GetUser",
            variables: [$var("opUserId").scalar("ID:!")],
          },
          ({ $ }) => ({
            user: userSlice.embed({ userId: $.opUserId }),
          })
        )
      );

      // When no metadata is provided, composed operations return empty nested objects
      // due to the merge logic
      expect(operation.metadata).toEqual({
        headers: {},
        extensions: {},
        custom: {},
      });
    });
  });
});
