import { describe, expect, it } from "bun:test";
import { type BasicTestSchema, basicTestSchema } from "../../test/fixtures";
import { defineOperationRoots } from "../schema";
import { GqlDefine } from "../types/element";
import { createCompatComposer } from "./compat";

const schema = basicTestSchema;
type Schema = BasicTestSchema;

describe("createCompatComposer", () => {
  describe("query.compat", () => {
    it("returns a GqlDefine instance", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      expect(compat).toBeInstanceOf(GqlDefine);
    });

    it("stores correct operationType and operationName", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const spec = compat.value;
      expect(spec.operationType).toBe("query");
      expect(spec.operationName).toBe("GetUser");
    });

    it("stores variables when provided", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");
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

      const spec = compat.value;
      expect(spec.variables).toHaveProperty("userId");
      expect(spec.variables.userId).toMatchObject({ kind: "scalar", name: "ID", modifier: "!" });
    });

    it("stores empty variables when not provided", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const spec = compat.value;
      expect(spec.variables).toEqual({});
    });

    it("stores fieldsBuilder as a function (unevaluated)", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const spec = compat.value;
      expect(typeof spec.fieldsBuilder).toBe("function");
    });

    it("stores schema reference", () => {
      const queryCompat = createCompatComposer<Schema, "query">(schema, "query");

      const compat = queryCompat({
        name: "GetUser",
        fields: ({ f }) => ({
          ...f.user({ id: "1" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const spec = compat.value;
      expect(spec.schema).toBe(schema);
    });
  });

  describe("mutation.compat", () => {
    it("stores correct operationType for mutation", () => {
      const mutationCompat = createCompatComposer<Schema, "mutation">(schema, "mutation");

      const compat = mutationCompat({
        name: "UpdateUser",
        fields: ({ f }) => ({
          ...f.updateUser({ id: "1", name: "New Name" })(({ f }) => ({
            ...f.id(),
          })),
        }),
      });

      const spec = compat.value;
      expect(spec.operationType).toBe("mutation");
      expect(spec.operationName).toBe("UpdateUser");
    });
  });

  describe("subscription.compat", () => {
    it("stores correct operationType for subscription", () => {
      const subscriptionCompat = createCompatComposer<Schema, "subscription">(schema, "subscription");

      const compat = subscriptionCompat({
        name: "OnUserUpdated",
        fields: ({ f }) => ({
          ...f.userUpdated({ userId: "1" })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        }),
      });

      const spec = compat.value;
      expect(spec.operationType).toBe("subscription");
      expect(spec.operationName).toBe("OnUserUpdated");
    });
  });

  describe("error handling", () => {
    it("throws error when operation type is not defined in schema", () => {
      const schemaWithoutQuery = {
        ...schema,
        operations: defineOperationRoots({
          query: null,
          mutation: "Mutation",
          subscription: "Subscription",
        }),
      };

      expect(() => {
        createCompatComposer(schemaWithoutQuery, "query");
      }).toThrow("Operation type query is not defined in schema roots");
    });
  });
});
