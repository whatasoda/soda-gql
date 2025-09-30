import { describe, expect, it } from "bun:test";
import { define, defineScalar, unsafeOutputRef } from "../../../packages/core/src";
import { createFieldFactories } from "../../../packages/core/src/operation/fields-builder";
import { createVarBuilder } from "../../../packages/core/src/operation/var-builder";
import type { AnyGraphqlSchema } from "../../../packages/core/src/types/schema";

describe("Schema Edge Cases", () => {
  describe("Non-existent field arguments", () => {
    it("should throw when requesting non-existent argument", () => {
      const schema = {
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {
          ...defineScalar("String", ({ type }) => ({
            input: type<string>(),
            output: type<string>(),
            directives: {},
          })),
        },
        enum: {},
        input: {},
        object: {
          ...define("Query").object(
            {
              user: unsafeOutputRef.scalar("String:!", {}, {}),
            },
            {},
          ),
        },
        union: {},
      } satisfies AnyGraphqlSchema;

      const helpers = createVarBuilder(schema);

      // Trying to get an argument that doesn't exist
      expect(() => {
        // @ts-expect-error - Testing runtime error handling for non-existent argument
        helpers.$("userVar").byField("Query", "user", "nonExistentArg");
      }).toThrow("Argument nonExistentArg not found in field user of type Query");
    });
  });

  describe("Missing object types", () => {
    it("should handle missing object type in schema", () => {
      const schema = {
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
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {},
        enum: {},
        input: {},
        object: {
          ...define("Query").object(
            {
              // Create a field with an invalid kind by casting
              weirdField: {
                kind: "invalid" as any,
                name: "String",
                modifier: "!",
                directives: {},
                arguments: {},
              } as any,
            },
            {},
          ),
        },
        union: {},
      } satisfies AnyGraphqlSchema;

      expect(() => {
        createFieldFactories(schema, "Query");
      }).toThrow("Unsupported field type");
    });
  });

  describe("Union with missing member types", () => {
    it("should handle union member types gracefully", () => {
      const schema = {
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {},
        enum: {},
        input: {},
        object: {
          ...define("Query").object(
            {
              result: unsafeOutputRef.union("SearchResult:!", {}, {}),
            },
            {},
          ),
        },
        union: {
          ...define("SearchResult").union(
            {
              MissingType: true, // This type doesn't exist in objects
            },
            {},
          ),
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
        operations: {
          query: "Query" as const,
          mutation: null,
          subscription: null,
        },
        scalar: {
          ...defineScalar("String", ({ type }) => ({
            input: type<string>(),
            output: type<string>(),
            directives: {},
          })),
        },
        enum: {},
        input: {},
        object: {
          ...define("Query").object(
            {
              node: unsafeOutputRef.object("Node:?", {}, {}),
            },
            {},
          ),
          ...define("Node").object(
            {
              id: unsafeOutputRef.scalar("String:!", {}, {}),
              parent: unsafeOutputRef.object("Node:?", {}, {}), // Circular reference
              children: unsafeOutputRef.object("Node:![]!", {}, {}), // Another circular reference
            },
            {},
          ),
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
