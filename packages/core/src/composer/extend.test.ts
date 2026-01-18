import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyGraphqlSchema } from "../types/schema";
import { Operation } from "../types/element";
import { createCompatComposer } from "./compat";
import { createExtendComposer } from "./extend";

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
    }),
    Mutation: define("Mutation").object({
      updateUser: unsafeOutputType.object("User:?", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
          name: unsafeInputType.scalar("String:!", {}),
        },
      }),
    }),
    Subscription: define("Subscription").object({
      userUpdated: unsafeOutputType.object("User:!", {
        arguments: {
          userId: unsafeInputType.scalar("ID:!", {}),
        },
      }),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

describe("createExtendComposer", () => {
  describe("basic extend", () => {
    it("returns an Operation instance", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation).toBeInstanceOf(Operation);
    });

    it("preserves operationType and operationName", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.operationType).toBe("query");
      expect(operation.operationName).toBe("GetUser");
    });

    it("preserves variableNames from compat", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);
      const mockVarDef = { kind: "scalar" as const, name: "ID" as const, modifier: "!" as const };

      const compat = queryCompat({
        name: "GetUser",
        variables: { userId: mockVarDef },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.variableNames).toEqual(["userId"]);
    });

    it("builds correct document", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const operation = extend(compat);
      const printed = print(operation.document);

      expect(printed).toContain("query GetUser");
      expect(printed).toContain("user(id: \"1\")");
      expect(printed).toContain("id");
      expect(printed).toContain("name");
    });

    it("returns undefined metadata when not provided", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.metadata).toBeUndefined();
    });
  });

  describe("extend with metadata", () => {
    it("builds metadata when provided", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat, {
        metadata: () => ({
          custom: { key: "value" },
        }),
      });

      expect(operation.metadata).toEqual({ custom: { key: "value" } });
    });

    it("metadata builder receives $ with variable refs", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);
      const mockVarDef = { kind: "scalar" as const, name: "ID" as const, modifier: "!" as const };

      let receivedVarRefs: Record<string, unknown> | undefined;

      const compat = queryCompat({
        name: "GetUser",
        variables: { userId: mockVarDef },
        fields: ({ f, $ }) => ({
          ...f.user({ id: $.userId })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat, {
        metadata: ({ $ }) => {
          receivedVarRefs = $ as Record<string, unknown>;
          return { custom: {} };
        },
      });

      // Trigger metadata evaluation
      void operation.metadata;

      expect(receivedVarRefs).toBeDefined();
      expect(receivedVarRefs).toHaveProperty("userId");
    });

    it("metadata builder receives document", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
      const extend = createExtendComposer<Schema>(schema);

      let receivedDocument: unknown;

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat, {
        metadata: ({ document }) => {
          receivedDocument = document;
          return { custom: {} };
        },
      });

      // Trigger metadata evaluation
      void operation.metadata;

      expect(receivedDocument).toBeDefined();
      expect((receivedDocument as { kind: string }).kind).toBe("Document");
    });
  });

  describe("mutation and subscription", () => {
    it("works with mutation.compat", () => {
      const mutationCompat = createCompatComposer<Schema, "mutation">(schema, "mutation");
      const extend = createExtendComposer<Schema>(schema);

      const compat = mutationCompat({
        name: "UpdateUser",
        fields: ({ f }) => ({
          ...f.updateUser({ id: "1", name: "New Name" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.operationType).toBe("mutation");
      expect(operation.operationName).toBe("UpdateUser");
      expect(print(operation.document)).toContain("mutation UpdateUser");
    });

    it("works with subscription.compat", () => {
      const subscriptionCompat = createCompatComposer<Schema, "subscription">(schema, "subscription");
      const extend = createExtendComposer<Schema>(schema);

      const compat = subscriptionCompat({
        name: "OnUserUpdated",
        fields: ({ f }) => ({
          ...f.userUpdated({ userId: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const operation = extend(compat);

      expect(operation.operationType).toBe("subscription");
      expect(operation.operationName).toBe("OnUserUpdated");
      expect(print(operation.document)).toContain("subscription OnUserUpdated");
    });
  });
});
