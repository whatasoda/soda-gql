import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyGraphqlSchema } from "../types/schema";
import { createOperationTaggedTemplate } from "./operation-tagged-template";

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
    ...defineScalar<"Int", string, number>("Int"),
    ...defineScalar<"Boolean", string, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:!", {
        arguments: { id: unsafeInputType.scalar("ID:!", {}) },
      }),
    }),
    Mutation: define("Mutation").object({
      updateUser: unsafeOutputType.object("User:!", {
        arguments: { id: unsafeInputType.scalar("ID:!", {}) },
      }),
    }),
    Subscription: define("Subscription").object({
      userUpdated: unsafeOutputType.object("User:!", {}),
    }),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

describe("createOperationTaggedTemplate", () => {
  describe("query tagged template", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("parses a valid query and produces an Operation", () => {
      const result = query`query GetUser { user(id: "1") { id name } }`();
      expect(result.operationType).toBe("query");
      expect(result.operationName).toBe("GetUser");
      expect(result.schemaLabel).toBe("test");
      expect(result.document).toBeDefined();
    });

    it("extracts variable names correctly", () => {
      const result = query`query GetUser($id: ID!) { user(id: $id) { id name } }`();
      expect(result.variableNames).toEqual(["id"]);
    });

    it("multiple variable definitions are correctly converted", () => {
      const result = query`query SearchUsers($id: ID!, $name: String) { user(id: $id) { id name } }`();
      expect(result.variableNames).toContain("id");
      expect(result.variableNames).toContain("name");
      expect(result.variableNames).toHaveLength(2);
    });
  });

  describe("mutation tagged template", () => {
    const mutation = createOperationTaggedTemplate(schema, "mutation");

    it("produces correct operationType", () => {
      const result = mutation`mutation UpdateUser($id: ID!) { updateUser(id: $id) { id } }`();
      expect(result.operationType).toBe("mutation");
      expect(result.operationName).toBe("UpdateUser");
    });
  });

  describe("subscription tagged template", () => {
    const subscription = createOperationTaggedTemplate(schema, "subscription");

    it("produces correct operationType", () => {
      const result = subscription`subscription OnUserUpdated { userUpdated { id name } }`();
      expect(result.operationType).toBe("subscription");
      expect(result.operationName).toBe("OnUserUpdated");
    });
  });

  describe("error handling", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("throws when operation type mismatches", () => {
      expect(() => query`mutation UpdateUser { updateUser(id: "1") { id } }`).toThrow(
        'Operation type mismatch: expected "query", got "mutation"',
      );
    });

    it("throws when source contains interpolation", () => {
      const fn = createOperationTaggedTemplate(schema, "query");
      expect(() => (fn as any)(["part1", "part2"], "interpolated")).toThrow("interpolated expressions");
    });

    it("throws on anonymous operations", () => {
      expect(() => query`query { user(id: "1") { id } }`).toThrow("Anonymous operations are not allowed");
    });

    it("throws on parse errors", () => {
      expect(() => query`query { invalid syntax!!! }`).toThrow("GraphQL parse error");
    });

    it("throws when no operation definitions found", () => {
      expect(() => query`fragment UserFields on User { id }`).toThrow("Expected exactly one operation definition, found 0");
    });

    it("throws when multiple operation definitions found", () => {
      expect(() => query`query GetUser { user(id: "1") { id } } query GetUser2 { user(id: "2") { id } }`).toThrow(
        "Expected exactly one operation definition, found 2",
      );
    });
  });

  describe("metadata", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("passes metadata through when provided", () => {
      const result = query`query GetUser { user(id: "1") { id } }`({
        metadata: { headers: { "X-Test": "1" } },
      });
      expect(result.metadata).toEqual({ headers: { "X-Test": "1" } });
    });

    it("metadata is undefined when not provided", () => {
      const result = query`query GetUser { user(id: "1") { id } }`();
      expect(result.metadata).toBeUndefined();
    });
  });
});
