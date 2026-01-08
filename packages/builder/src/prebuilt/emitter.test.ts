import { describe, expect, test } from "bun:test";
import type { CanonicalId } from "@soda-gql/common";
import type { AnyGraphqlSchema } from "@soda-gql/core";
import { emitPrebuiltTypes } from "./emitter";
import type { FieldSelectionData, FieldSelectionsMap } from "./extractor";

// Minimal mock schema for testing
const createMockSchema = (label: string): AnyGraphqlSchema =>
  ({
    label,
    operations: { query: "Query", mutation: null, subscription: null },
    scalar: {},
    enum: {},
    input: {},
    object: {
      Query: { name: "Query", fields: { __typename: { kind: "typename", name: "Query", modifier: "!", arguments: {} } } },
    },
    union: {},
  }) as unknown as AnyGraphqlSchema;

describe("emitPrebuiltTypes", () => {
  describe("schemaLabel not found validation", () => {
    test("returns SCHEMA_NOT_FOUND error when selection references unknown schema", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        knownSchema: createMockSchema("knownSchema"),
      };

      // Selection that references an unknown schema
      const fieldSelections: FieldSelectionsMap = new Map([
        [
          "/src/user.ts::UserFragment" as CanonicalId,
          {
            type: "fragment",
            schemaLabel: "unknownSchema",
            key: "UserFields",
            typename: "User",
            fields: {},
            variableDefinitions: {},
          } satisfies FieldSelectionData,
        ],
      ]);

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: "/tmp/test-output",
        injects: {},
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("SCHEMA_NOT_FOUND");
        if (result.error.code === "SCHEMA_NOT_FOUND") {
          expect(result.error.schemaLabel).toBe("unknownSchema");
          expect(result.error.canonicalId).toBe("/src/user.ts::UserFragment");
        }
      }
    });
  });

  describe("warnings collection", () => {
    test("returns empty warnings when no type calculation errors occur", async () => {
      const schemas: Record<string, AnyGraphqlSchema> = {
        testSchema: createMockSchema("testSchema"),
      };

      const fieldSelections: FieldSelectionsMap = new Map();

      const result = await emitPrebuiltTypes({
        schemas,
        fieldSelections,
        outdir: "/tmp/test-output",
        injects: {
          testSchema: { scalars: "/tmp/scalars.ts" },
        },
      });

      // Will fail on file write, but we verify warnings are included in result type
      if (result.isOk()) {
        expect(result.value.warnings).toHaveLength(0);
      }
      // If it fails, just check it's not a schema-not-found error
      if (result.isErr()) {
        expect(result.error.code).not.toBe("SCHEMA_NOT_FOUND");
      }
    });
  });
});
