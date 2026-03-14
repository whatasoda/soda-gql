import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { OperationMetadataContext } from "../../src/composer/operation-tagged-template";
import { getVarRefName } from "../../src/composer/var-ref-tools";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";
import { VarRef } from "../../src/types/type-foundation";
import { asMinimalSchema, define, unsafeInputType, unsafeOutputType } from "../utils/schema";

const schema = asMinimalSchema({
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
} satisfies AnyGraphqlSchema);

type Schema = typeof schema & { _?: never };

describe("metadata with variable access", () => {
  describe("operation", () => {
    it("metadata callback receives $ with variable refs", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $ }: OperationMetadataContext) => ({
            custom: {
              trackedVariables: [VarRef.getInner($.userId)],
            },
          }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.trackedVariables).toEqual([{ type: "variable", name: "userId" }]);
    });

    it("getVarRefName extracts variable name", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $ }: OperationMetadataContext) => ({
            custom: {
              variableNames: [getVarRefName($.userId)],
            },
          }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.variableNames).toEqual(["userId"]);
    });

    it("works with multiple variables", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ mutation }) =>
        mutation("UpdateUser")({
          variables: `($userId: ID!, $userName: String!)`,
          fields: ({ f, $ }) => ({ ...f("updateUser", { id: $.userId, name: $.userName })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $ }: OperationMetadataContext) => ({
            custom: {
              trackedVars: {
                userId: getVarRefName($.userId),
                userName: getVarRefName($.userName),
              },
            },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.trackedVars).toEqual({
        userId: "userId",
        userName: "userName",
      });
    });

    it("metadata is undefined when not provided", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({}),
      );

      expect(operation.metadata).toBeUndefined();
    });

    it("metadata callback receives document as DocumentNode", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ document }: OperationMetadataContext) => ({
            custom: {
              documentHash: createHash("sha256").update(print(document)).digest("hex"),
            },
          }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.documentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("metadata callback can access both $ and document", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $, document }: OperationMetadataContext) => ({
            headers: {
              "X-Variable-Name": getVarRefName($.userId),
            },
            custom: {
              hasDocument: document.kind === "Document",
            },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.headers?.["X-Variable-Name"]).toBe("userId");
      expect(meta.custom?.hasDocument).toBe(true);
    });
  });
});
