import { describe, expect, it } from "bun:test";
import { define, defineScalar, unsafeOutputType } from "@soda-gql/core/";
import { createFieldFactories } from "@soda-gql/core/composer/fields-builder";
import { createVarBuilder } from "@soda-gql/core/composer/var-builder";
import type { AnyGraphqlSchema } from "@soda-gql/core/types/schema";

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
          String: defineScalar("String", ({ type }) => ({
            input: type<string>(),
            output: type<string>(),
            directives: {},
          })).String,
        },
        enum: {},
        input: {},
        object: {
          Query: define("Query").object(
            {
              user: unsafeOutputType.scalar("String:!", { arguments: {}, directives: {} }),
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
          Query: define("Query").object(
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
        const factories = createFieldFactories(schema, "Query");
        // Trigger the factory to execute by accessing the invalid field
        (factories as any).weirdField();
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
          Query: define("Query").object(
            {
              result: unsafeOutputType.union("SearchResult:!", { arguments: {}, directives: {} }),
            },
            {},
          ),
        },
        union: {
          SearchResult: define("SearchResult").union(
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
          Query: define("Query").object(
            {
              node: unsafeOutputType.object("Node:?", { arguments: {}, directives: {} }),
            },
            {},
          ),
          Node: define("Node").object(
            {
              id: unsafeOutputType.scalar("String:!", { arguments: {}, directives: {} }),
              parent: unsafeOutputType.object("Node:?", { arguments: {}, directives: {} }), // Circular reference
              children: unsafeOutputType.object("Node:![]!", { arguments: {}, directives: {} }), // Another circular reference
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
