import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { OperationMetadataContext } from "../../src/composer/operation-tagged-template";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";
import { VarRef } from "../../src/types/type-foundation";
import { createVarRefFromNestedValue, createVarRefFromVariable } from "../../src/types/type-foundation/var-ref";
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

    it("$var.getName extracts variable name", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $, $var }: OperationMetadataContext) => ({
            custom: {
              variableNames: [$var.getName($.userId)],
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
          metadata: ({ $, $var }: OperationMetadataContext) => ({
            custom: {
              trackedVars: {
                userId: $var.getName($.userId),
                userName: $var.getName($.userName),
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
          metadata: ({ $, $var, document }: OperationMetadataContext) => ({
            headers: {
              "X-Variable-Name": $var.getName($.userId),
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

  describe("$var tools use cases", () => {
    it("cache key generation from variable names", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")(), ...f("name")() })) }),
        })({
          metadata: ({ $, $var }: OperationMetadataContext) => ({
            custom: {
              cacheKey: `GetUser:${$var.getName($.userId)}`,
            },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.cacheKey).toBe("GetUser:userId");
    });

    it("conditional request headers based on variable presence", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ query }) =>
        query("GetUsers")({
          variables: `($categoryId: ID)`,
          fields: ({ f, $ }) => ({ ...f("users", { categoryId: $.categoryId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $, $var }: OperationMetadataContext) => ({
            headers: {
              "X-Has-Category-Filter": String($var.getName($.categoryId) !== undefined),
            },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.headers?.["X-Has-Category-Filter"]).toBe("true");
    });

    it("decomposing nested input structures", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const pageOffsetRef = createVarRefFromVariable("pageOffset");
      const nestedInput = createVarRefFromNestedValue({
        pagination: { limit: 20, offset: pageOffsetRef },
        filter: { status: "active" },
      });

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $var }: OperationMetadataContext) => ({
            custom: {
              staticLimit: $var.getValueAt(nestedInput, (p: any) => p.pagination.limit),
              filterStatus: $var.getValueAt(nestedInput, (p: any) => p.filter.status),
              offsetVarName: $var.getNameAt(nestedInput, (p: any) => p.pagination.offset),
              offsetPath: $var.getPath(nestedInput, (p: any) => p.pagination.offset),
            },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.staticLimit).toBe(20);
      expect(meta.custom?.filterStatus).toBe("active");
      expect(meta.custom?.offsetVarName).toBe("pageOffset");
      expect(meta.custom?.offsetPath).toEqual(["$pageOffset"]);
    });

    it("variable labeling for backend communication", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const operation = gql(({ mutation }) =>
        mutation("UpdateUser")({
          variables: `($userId: ID!, $userName: String!)`,
          fields: ({ f, $ }) => ({ ...f("updateUser", { id: $.userId, name: $.userName })(({ f }) => ({ ...f("id")() })) }),
        })({
          metadata: ({ $, $var }: OperationMetadataContext) => ({
            custom: {
              variableLabels: {
                [$var.getName($.userId)]: { role: "identifier", sensitivity: "pii" },
                [$var.getName($.userName)]: { role: "payload", sensitivity: "pii" },
              },
            },
          }),
        }),
      );

      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.variableLabels).toEqual({
        userId: { role: "identifier", sensitivity: "pii" },
        userName: { role: "payload", sensitivity: "pii" },
      });
    });
  });
});
