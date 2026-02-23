import { describe, expect, it } from "bun:test";
import { define, unsafeInputType, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import { GqlDefine } from "../types/element";
import { isTemplateCompatSpec } from "../types/element/compat-spec";
import type { AnyGraphqlSchema } from "../types/schema";
import { createCompatTaggedTemplate } from "./compat-tagged-template";

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

describe("createCompatTaggedTemplate", () => {
  describe("query compat tagged template", () => {
    const queryCompat = createCompatTaggedTemplate(schema, "query");

    it("returns a GqlDefine instance", () => {
      const result = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      expect(result).toBeInstanceOf(GqlDefine);
    });

    it("GqlDefine.value contains correct spec properties", () => {
      const result = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const spec = result.value;
      expect(spec.schema).toBe(schema);
      expect(spec.operationType).toBe("query");
      expect(spec.operationName).toBe("GetUser");
      expect(spec.graphqlSource).toContain("query GetUser");
    });

    it("stores synthesized graphqlSource string", () => {
      const result = queryCompat("GetUser")`($id: ID!) { user(id: $id) { id name } }`;
      const spec = result.value;
      expect(spec.graphqlSource).toBe("query GetUser ($id: ID!) { user(id: $id) { id name } }");
    });

    it("spec passes isTemplateCompatSpec type guard", () => {
      const result = queryCompat("GetUser")`{ user(id: "1") { id } }`;
      expect(isTemplateCompatSpec(result.value)).toBe(true);
    });
  });

  describe("mutation compat tagged template", () => {
    const mutationCompat = createCompatTaggedTemplate(schema, "mutation");

    it("produces correct operationType and operationName", () => {
      const result = mutationCompat("UpdateUser")`($id: ID!) { updateUser(id: $id) { id } }`;
      const spec = result.value;
      expect(spec.operationType).toBe("mutation");
      expect(spec.operationName).toBe("UpdateUser");
    });
  });

  describe("subscription compat tagged template", () => {
    const subscriptionCompat = createCompatTaggedTemplate(schema, "subscription");

    it("produces correct operationType and operationName", () => {
      const result = subscriptionCompat("OnUserUpdated")`{ userUpdated { id name } }`;
      const spec = result.value;
      expect(spec.operationType).toBe("subscription");
      expect(spec.operationName).toBe("OnUserUpdated");
    });
  });

  describe("error handling", () => {
    const queryCompat = createCompatTaggedTemplate(schema, "query");

    it("throws on invalid GraphQL syntax", () => {
      expect(() => queryCompat("Foo")`{ invalid syntax!!! }`).toThrow("GraphQL parse error");
    });

    it("throws when operation type is not defined in schema roots", () => {
      const noSubscriptionSchema = {
        ...schema,
        operations: defineOperationRoots({
          query: "Query",
          mutation: "Mutation",
          subscription: null,
        }),
      };

      expect(() => createCompatTaggedTemplate(noSubscriptionSchema, "subscription")).toThrow(
        "Operation type subscription is not defined in schema roots",
      );
    });

    it("throws on interpolation values", () => {
      expect(() => (queryCompat("Foo") as any)(["part1", "part2"], "interpolated")).toThrow("interpolated expressions");
    });
  });
});
