import { describe, expect, it } from "bun:test";
import {
  buildArgumentValue,
  buildConstValueNode,
  buildDocument,
  buildWithTypeModifier,
} from "@soda-gql/core/composer/build-document";
import type { TypeModifier } from "@soda-gql/core/types/schema/type-modifier";
import type { InputTypeSpecifiers } from "@soda-gql/core/types/schema/type-specifier";
import { Kind } from "graphql";

describe("Document Integrity Tests", () => {
  describe("buildArgumentValue edge cases", () => {
    it("should throw on symbol argument values", () => {
      const symbolValue = Symbol("test");

      expect(() => {
        buildArgumentValue(symbolValue as unknown as never);
      }).toThrow("Unknown value type");
    });

    it("should throw on function argument values", () => {
      const functionValue = () => "test";

      expect(() => {
        buildArgumentValue(functionValue as unknown as never);
      }).toThrow("Unknown value type");
    });

    it("should handle null values", () => {
      const result = buildArgumentValue(null);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe(Kind.NULL);
    });

    it("should handle boolean values", () => {
      const result = buildArgumentValue(true);
      expect(result).toEqual({
        kind: Kind.BOOLEAN,
        value: true,
      });
    });

    it("should handle string values", () => {
      const result = buildArgumentValue("test");
      expect(result).toEqual({
        kind: Kind.STRING,
        value: "test",
      });
    });

    it("should handle number values", () => {
      const result = buildArgumentValue(42);
      expect(result).toEqual({
        kind: Kind.INT,
        value: "42",
      });

      const floatResult = buildArgumentValue(3.14);
      expect(floatResult).toEqual({
        kind: Kind.FLOAT,
        value: "3.14",
      });
    });

    it("should handle array values", () => {
      const result = buildArgumentValue([1, 2, 3]);
      expect(result).toEqual({
        kind: Kind.LIST,
        values: Array.from({ length: 3 }, () => expect.anything()),
      });
    });

    it("should handle object values", () => {
      const result = buildArgumentValue({ field: "value" });
      expect(result).toEqual({
        kind: Kind.OBJECT,
        fields: Array.from({ length: 1 }, () => expect.anything()),
      });
    });
  });

  describe("buildWithTypeModifier invalid modifiers", () => {
    it("should throw on invalid modifier strings", () => {
      const buildType = () => ({
        kind: Kind.NAMED_TYPE as Kind.NAMED_TYPE,
        name: { kind: Kind.NAME as Kind.NAME, value: "String" },
      });

      // Test invalid modifiers - new format requires ? or ! followed by []? or []! pairs
      expect(() => {
        buildWithTypeModifier("???" as TypeModifier, buildType);
      }).toThrow("Unknown modifier");

      // "!!" is now invalid in the new modifier format
      expect(() => {
        buildWithTypeModifier("!!" as TypeModifier, buildType);
      }).toThrow("Unknown modifier");
    });

    it("should handle valid modifiers correctly", () => {
      const buildType = () => ({
        kind: Kind.NAMED_TYPE as Kind.NAMED_TYPE,
        name: { kind: Kind.NAME as Kind.NAME, value: "String" },
      });

      const nonNull = buildWithTypeModifier("!", buildType);
      expect(nonNull.kind).toBe(Kind.NON_NULL_TYPE);

      const list = buildWithTypeModifier("?[]?", buildType);
      expect(list.kind).toBe(Kind.LIST_TYPE);

      const nonNullList = buildWithTypeModifier("?[]!", buildType);
      expect(nonNullList).toEqual({
        kind: Kind.NON_NULL_TYPE,
        type: expect.objectContaining({ kind: Kind.LIST_TYPE }),
      });

      const listOfNonNull = buildWithTypeModifier("![]?", buildType);
      expect(listOfNonNull).toEqual({
        kind: Kind.LIST_TYPE,
        type: expect.objectContaining({ kind: Kind.NON_NULL_TYPE }),
      });
    });
  });

  describe("buildConstValueNode with unsupported types", () => {
    it("should throw on BigInt values", () => {
      const bigIntValue = BigInt(9007199254740991);

      expect(() => {
        buildConstValueNode(bigIntValue as any);
      }).toThrow();
    });

    it("should return null for undefined values", () => {
      // undefined returns null, not throws
      const result = buildConstValueNode(undefined as any);
      expect(result).toBeNull();
    });

    it("should throw on symbol values", () => {
      const symbolValue = Symbol("test");

      expect(() => {
        buildConstValueNode(symbolValue as any);
      }).toThrow();
    });

    it("should handle valid const values", () => {
      expect(buildConstValueNode(null)?.kind).toBe(Kind.NULL);
      expect(buildConstValueNode(true)?.kind).toBe(Kind.BOOLEAN);
      expect(buildConstValueNode("string")?.kind).toBe(Kind.STRING);
      expect(buildConstValueNode(42)?.kind).toBe(Kind.INT);
      expect(buildConstValueNode(3.14)?.kind).toBe(Kind.FLOAT);
      expect(buildConstValueNode([1, 2])?.kind).toBe(Kind.LIST);
      expect(buildConstValueNode({ key: "value" })?.kind).toBe(Kind.OBJECT);
    });
  });

  describe("buildDocument with invalid operation types", () => {
    it("should throw on invalid operation type", () => {
      const invalidOperation = "queryish" as any;

      expect(() => {
        buildDocument({
          operationType: invalidOperation,
          operationName: "TestOperation",
          variables: {} as InputTypeSpecifiers,
          fields: {},
        });
      }).toThrow();
    });

    it("should handle valid operation types", () => {
      const queryDoc = buildDocument({
        operationType: "query",
        operationName: "TestQuery",
        variables: {},
        fields: {},
      });
      expect(queryDoc.definitions[0]).toEqual(
        expect.objectContaining({
          kind: Kind.OPERATION_DEFINITION,
          operation: "query",
        }),
      );

      const mutationDoc = buildDocument({
        operationType: "mutation",
        operationName: "TestMutation",
        variables: {},
        fields: {},
      });
      expect(mutationDoc.definitions[0]).toEqual(
        expect.objectContaining({
          kind: Kind.OPERATION_DEFINITION,
          operation: "mutation",
        }),
      );

      const subscriptionDoc = buildDocument({
        operationType: "subscription",
        operationName: "TestSubscription",
        variables: {},
        fields: {},
      });
      expect(subscriptionDoc.definitions[0]).toEqual(
        expect.objectContaining({
          kind: Kind.OPERATION_DEFINITION,
          operation: "subscription",
        }),
      );
    });
  });

  describe("buildConstValueNode with default values", () => {
    it("should handle various default value types", () => {
      const stringValue = buildConstValueNode("default");
      expect(stringValue).toEqual({
        kind: Kind.STRING,
        value: "default",
      });

      const numberValue = buildConstValueNode(42);
      expect(numberValue).toBeDefined();
      expect(numberValue?.kind).toBe(Kind.INT);

      const booleanValue = buildConstValueNode(true);
      expect(booleanValue).toBeDefined();
      expect(booleanValue?.kind).toBe(Kind.BOOLEAN);
    });

    it("should handle complex default values", () => {
      const complexDefault = {
        field1: "value1",
        field2: 42,
        field3: [1, 2, 3],
      };

      const objectValue = buildConstValueNode(complexDefault);
      expect(objectValue).toBeDefined();
      expect(objectValue).toEqual({
        kind: Kind.OBJECT,
        fields: Array.from({ length: 3 }, () => expect.anything()),
      });
    });
  });
});
