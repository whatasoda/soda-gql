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
      const result = query("GetUser")`{ user(id: "1") { id name } }`();
      expect(result.operationType).toBe("query");
      expect(result.operationName).toBe("GetUser");
      expect(result.schemaLabel).toBe("test");
      expect(result.document).toBeDefined();
    });

    it("extracts variable names correctly", () => {
      const result = query("GetUser")`($id: ID!) { user(id: $id) { id name } }`();
      expect(result.variableNames).toEqual(["id"]);
    });

    it("multiple variable definitions are correctly converted", () => {
      const result = query("SearchUsers")`($id: ID!, $name: String) { user(id: $id) { id name } }`();
      expect(result.variableNames).toContain("id");
      expect(result.variableNames).toContain("name");
      expect(result.variableNames).toHaveLength(2);
    });
  });

  describe("mutation tagged template", () => {
    const mutation = createOperationTaggedTemplate(schema, "mutation");

    it("produces correct operationType", () => {
      const result = mutation("UpdateUser")`($id: ID!) { updateUser(id: $id) { id } }`();
      expect(result.operationType).toBe("mutation");
      expect(result.operationName).toBe("UpdateUser");
    });
  });

  describe("subscription tagged template", () => {
    const subscription = createOperationTaggedTemplate(schema, "subscription");

    it("produces correct operationType", () => {
      const result = subscription("OnUserUpdated")`{ userUpdated { id name } }`();
      expect(result.operationType).toBe("subscription");
      expect(result.operationName).toBe("OnUserUpdated");
    });
  });

  describe("error handling", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("throws when interpolated value is not a Fragment or callback", () => {
      expect(() => (query("Foo") as any)(["part1", "part2"], "interpolated")).toThrow(
        "Tagged templates only accept Fragment instances or callback functions as interpolated values",
      );
    });

    it("throws on parse errors", () => {
      expect(() => query("Foo")`{ invalid syntax!!! }`).toThrow("GraphQL parse error");
    });
  });

  describe("metadata", () => {
    const query = createOperationTaggedTemplate(schema, "query");

    it("passes metadata through when provided", () => {
      const result = query("GetUser")`{ user(id: "1") { id } }`({
        metadata: { headers: { "X-Test": "1" } },
      });
      expect(result.metadata).toEqual({ headers: { "X-Test": "1" } });
    });

    it("metadata is undefined when not provided", () => {
      const result = query("GetUser")`{ user(id: "1") { id } }`();
      expect(result.metadata).toBeUndefined();
    });
  });
});
