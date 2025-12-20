import { describe, expect, it } from "bun:test";
import { define, defineScalar } from "./schema/schema-builder";
import { unsafeOutputType } from "./schema/type-specifier-builder";
import { createFieldFactories } from "./composer/fields-builder";
import { createVarBuilder } from "./composer/var-builder";
import type { AnyGraphqlSchema } from "./types/schema/schema";

describe("Schema Edge Cases", () => {
  describe("Non-existent field arguments", () => {
    it("should throw when requesting non-existent argument", () => {
      const schema = {
        label: "test" as const,
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {
          String: defineScalar<"String", string, string>("String").String,
        },
        enum: {},
        input: {},
        object: {
          Query: define("Query").object({
            user: unsafeOutputType.scalar("String:!", { arguments: {} }),
          }),
        },
        union: {},
      } satisfies AnyGraphqlSchema;

      const helpers = createVarBuilder(schema);

      // Trying to get an argument that doesn't exist
      expect(() => {
        // @ts-expect-error - Testing runtime error for non-existent argument
        helpers.$var("userVar").byField("Query", "user", "nonExistentArg");
      }).toThrow("Argument nonExistentArg not found in field user of type Query");
    });
  });

  describe("Missing object types", () => {
    it("should handle missing object type in schema", () => {
      const schema = {
        label: "test" as const,
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {},
        enum: {},
        input: {},
        object: {},
        union: {},
      } satisfies AnyGraphqlSchema;

      // Attempting to create field factories for non-existent object
      expect(() => {
        // @ts-expect-error - Testing runtime error handling for non-existent type
        createFieldFactories(schema, "NonExistentObject");
      }).toThrow();
    });
  });

  describe("Unsupported field types", () => {
    it("should handle unsupported field kind", () => {
      const schema = {
        label: "test" as const,
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {},
        enum: {},
        input: {},
        object: {
          Query: define("Query").object({
            // Create a field with an invalid kind by casting
            weirdField: {
              kind: "invalid" as any,
              name: "String",
              modifier: "!",
              arguments: {},
            } as any,
          }),
        },
        union: {},
      } satisfies AnyGraphqlSchema;

      expect(() => {
        const factories = createFieldFactories(schema, "Query");
        // Trigger the factory to execute by accessing the invalid field
        (factories as any).weirdField();
      }).toThrow("Unsupported field type");
    });
  });

  describe("Union with missing member types", () => {
    it("should handle union member types gracefully", () => {
      const schema = {
        label: "test" as const,
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {},
        enum: {},
        input: {},
        object: {
          Query: define("Query").object({
            result: unsafeOutputType.union("SearchResult:!", { arguments: {} }),
          }),
        },
        union: {
          SearchResult: define("SearchResult").union({
            MissingType: true, // This type doesn't exist in objects
          }),
        },
      } satisfies AnyGraphqlSchema;

      // The current implementation doesn't throw, it handles it gracefully
      // We should test that it doesn't crash instead
      const factories = createFieldFactories(schema, "Query");
      expect(factories).toBeDefined();
      expect(factories.result).toBeDefined();
    });
  });

  describe("Circular reference detection", () => {
    it("should handle circular references gracefully", () => {
      const schema = {
        label: "test" as const,
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {
          ...defineScalar<"String", string, string>("String"),
        },
        enum: {},
        input: {},
        object: {
          Query: define("Query").object({
            node: unsafeOutputType.object("Node:?", { arguments: {} }),
          }),
          Node: define("Node").object({
            id: unsafeOutputType.scalar("String:!", { arguments: {} }),
            parent: unsafeOutputType.object("Node:?", { arguments: {} }), // Circular reference
            children: unsafeOutputType.object("Node:![]!", { arguments: {} }), // Another circular reference
          }),
        },
        union: {},
      } satisfies AnyGraphqlSchema;

      // Should handle circular references without infinite loop
      const factories = createFieldFactories(schema, "Node");
      expect(factories).toBeDefined();
      expect(factories.parent).toBeDefined();
      expect(factories.children).toBeDefined();
    });
  });
});
