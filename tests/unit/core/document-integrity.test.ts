import { describe, expect, it } from "bun:test";
import { Kind } from "graphql";
import {
  buildArgumentValue,
  buildConstValueNode,
  buildDocument,
  buildWithTypeModifier,
} from "../../../packages/core/src/builder/document-builder";
import type { TypeModifier } from "../../../packages/core/src/types/type-ref";

describe("Document Integrity Tests", () => {
  describe("buildArgumentValue edge cases", () => {
    it("should throw on symbol argument values", () => {
      const symbolValue = Symbol("test");

      expect(() => {
        buildArgumentValue(symbolValue);
      }).toThrow("Unknown value type");
    });

    it("should throw on function argument values", () => {
      const functionValue = () => "test";

      expect(() => {
        buildArgumentValue(functionValue);
      }).toThrow("Unknown value type");
    });

    it("should handle null values", () => {
      const result = buildArgumentValue(null);
      expect(result.kind).toBe(Kind.NULL);
    });

    it("should handle boolean values", () => {
      const result = buildArgumentValue(true);
      expect(result.kind).toBe(Kind.BOOLEAN);
      expect((result as any).value).toBe(true);
    });

    it("should handle string values", () => {
      const result = buildArgumentValue("test");
      expect(result.kind).toBe(Kind.STRING);
      expect((result as any).value).toBe("test");
    });

    it("should handle number values", () => {
      const result = buildArgumentValue(42);
      expect(result.kind).toBe(Kind.INT);
      expect((result as any).value).toBe("42");

      const floatResult = buildArgumentValue(3.14);
      expect(floatResult.kind).toBe(Kind.FLOAT);
      expect((floatResult as any).value).toBe("3.14");
    });

    it("should handle array values", () => {
      const result = buildArgumentValue([1, 2, 3]);
      expect(result.kind).toBe(Kind.LIST);
      expect((result as any).values).toHaveLength(3);
    });

    it("should handle object values", () => {
      const result = buildArgumentValue({ field: "value" });
      expect(result.kind).toBe(Kind.OBJECT);
      expect((result as any).fields).toHaveLength(1);
    });
  });

  describe("buildWithTypeModifier invalid modifiers", () => {
    it("should throw on invalid modifier strings", () => {
      const buildType = () => ({ kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } });

      // "![]" is actually a valid modifier (list of non-null), not invalid
      // So let's test actual invalid modifiers
      expect(() => {
        buildWithTypeModifier("???" as TypeModifier, buildType);
      }).toThrow("Unknown modifier");

      // "!!" results in double non-null, which gets normalized
      const doubleNonNull = buildWithTypeModifier("!!" as TypeModifier, buildType);
      expect(doubleNonNull.kind).toBe(Kind.NON_NULL_TYPE);
    });

    it("should handle valid modifiers correctly", () => {
      const buildType = () => ({ kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } });

      const nonNull = buildWithTypeModifier("!", buildType);
      expect(nonNull.kind).toBe(Kind.NON_NULL_TYPE);

      const list = buildWithTypeModifier("[]", buildType);
      expect(list.kind).toBe(Kind.LIST_TYPE);

      const nonNullList = buildWithTypeModifier("[]!", buildType);
      expect(nonNullList.kind).toBe(Kind.NON_NULL_TYPE);
      expect((nonNullList as any).type.kind).toBe(Kind.LIST_TYPE);

      const listOfNonNull = buildWithTypeModifier("![]", buildType);
      expect(listOfNonNull.kind).toBe(Kind.LIST_TYPE);
      expect((listOfNonNull as any).type.kind).toBe(Kind.NON_NULL_TYPE);
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
      expect(buildConstValueNode(null).kind).toBe(Kind.NULL);
      expect(buildConstValueNode(true).kind).toBe(Kind.BOOLEAN);
      expect(buildConstValueNode("string").kind).toBe(Kind.STRING);
      expect(buildConstValueNode(42).kind).toBe(Kind.INT);
      expect(buildConstValueNode(3.14).kind).toBe(Kind.FLOAT);
      expect(buildConstValueNode([1, 2]).kind).toBe(Kind.LIST);
      expect(buildConstValueNode({ key: "value" }).kind).toBe(Kind.OBJECT);
    });
  });

  describe("buildDocument with invalid operation types", () => {
    it("should throw on invalid operation type", () => {
      const invalidOperation = "queryish" as any;

      expect(() => {
        buildDocument(invalidOperation, "TestOperation", [], [], []);
      }).toThrow();
    });

    it("should handle valid operation types", () => {
      const queryDoc = buildDocument("query", "TestQuery", [], [], []);
      expect(queryDoc.definitions[0].kind).toBe(Kind.OPERATION_DEFINITION);
      expect((queryDoc.definitions[0] as any).operation).toBe("query");

      const mutationDoc = buildDocument("mutation", "TestMutation", [], [], []);
      expect(mutationDoc.definitions[0].kind).toBe(Kind.OPERATION_DEFINITION);
      expect((mutationDoc.definitions[0] as any).operation).toBe("mutation");

      const subscriptionDoc = buildDocument("subscription", "TestSubscription", [], [], []);
      expect(subscriptionDoc.definitions[0].kind).toBe(Kind.OPERATION_DEFINITION);
      expect((subscriptionDoc.definitions[0] as any).operation).toBe("subscription");
    });
  });

  describe("Variable default value validation", () => {
    it("should handle various default value types", () => {
      const variableWithDefault = {
        name: { kind: Kind.NAME as const, value: "testVar" },
        type: { kind: Kind.NAMED_TYPE as const, name: { kind: Kind.NAME as const, value: "String" } },
        defaultValue: buildConstValueNode("default"),
        directives: [],
      };

      const doc = buildDocument("query", "TestQuery", [variableWithDefault], [], []);
      const varDef = (doc.definitions[0] as any).variableDefinitions[0];
      expect(varDef.defaultValue).toBeDefined();
      expect(varDef.defaultValue.kind).toBe(Kind.STRING);
    });

    it("should handle complex default values", () => {
      const complexDefault = {
        field1: "value1",
        field2: 42,
        field3: [1, 2, 3],
      };

      const variableWithComplexDefault = {
        name: { kind: Kind.NAME as const, value: "input" },
        type: { kind: Kind.NAMED_TYPE as const, name: { kind: Kind.NAME as const, value: "InputType" } },
        defaultValue: buildConstValueNode(complexDefault),
        directives: [],
      };

      const doc = buildDocument("query", "TestQuery", [variableWithComplexDefault], [], []);
      const varDef = (doc.definitions[0] as any).variableDefinitions[0];
      expect(varDef.defaultValue).toBeDefined();
      expect(varDef.defaultValue.kind).toBe(Kind.OBJECT);
    });
  });
});
