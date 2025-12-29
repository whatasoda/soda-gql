import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { print } from "graphql";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { define, defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../../src/schema/type-specifier-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";

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

describe("metadata with variable access", () => {
  describe("operation", () => {
    it("metadata callback receives $ with variable refs", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").scalar("ID:!") },
          metadata: ({ $ }) => ({
            custom: {
              trackedVariables: [$var.getInner($.userId)],
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.trackedVariables).toEqual([{ type: "variable", name: "userId" }]);
    });

    it("$var.getName extracts variable name", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").scalar("ID:!") },
          metadata: ({ $ }) => ({
            custom: {
              variableNames: [$var.getName($.userId)],
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.variableNames).toEqual(["userId"]);
    });

    it("works with multiple variables", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ mutation }, { $var }) =>
        mutation.operation({
          name: "UpdateUser",
          variables: { ...$var("userId").scalar("ID:!"), ...$var("userName").scalar("String:!") },
          metadata: ({ $ }) => ({
            custom: {
              trackedVars: {
                userId: $var.getName($.userId),
                userName: $var.getName($.userName),
              },
            },
          }),
          fields: ({ f, $ }) => ({ ...f.updateUser({ id: $.userId, name: $.userName })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.trackedVars).toEqual({
        userId: "userId",
        userName: "userName",
      });
    });

    it("metadata is undefined when not provided", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").scalar("ID:!") },
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeUndefined();
    });

    it("metadata callback receives document as DocumentNode", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").scalar("ID:!") },
          metadata: ({ document }) => ({
            custom: {
              documentHash: createHash("sha256").update(print(document)).digest("hex"),
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.documentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("metadata callback can access both $ and document", () => {
      const gql = createGqlElementComposer<Schema>(schema);

      const operation = gql(({ query }, { $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").scalar("ID:!") },
          metadata: ({ $, document }) => ({
            headers: {
              "X-Variable-Name": $var.getName($.userId),
            },
            custom: {
              hasDocument: document.kind === "Document",
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.headers?.["X-Variable-Name"]).toBe("userId");
      expect(meta.custom?.hasDocument).toBe(true);
    });
  });
});
