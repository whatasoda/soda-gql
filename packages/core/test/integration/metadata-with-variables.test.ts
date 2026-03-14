import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { MinimalSchema } from "../../src/types/schema";
import { VarRef } from "../../src/types/type-foundation";
import { define, unsafeInputType, unsafeOutputType } from "../utils/schema";
import { getVarRefName } from "../../src/composer/var-ref-tools";

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
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies MinimalSchema;

type Schema = typeof schema & { _?: never };

describe("metadata with variable access", () => {
  describe("operation", () => {
    it("metadata callback receives $ with variable refs", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: ({ $ }) => ({
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
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: ({ $ }) => ({
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
          fields: ({ f, $ }) => ({ ...f("updateUser", { id: $.userId, name: $.userName })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: ({ $ }) => ({
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
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: ({ document }) => ({
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
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: ({ $, document }) => ({
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
