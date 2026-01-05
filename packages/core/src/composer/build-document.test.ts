import { describe, expect, it } from "bun:test";
import { Kind, print } from "graphql";
import type { InputTypeSpecifiers, TypeModifier } from "../types/type-foundation";
import { DirectiveRef } from "../types/type-foundation/directive-ref";
import { createVarRefFromNestedValue, createVarRefFromVariable } from "../types/type-foundation/var-ref";
import { buildArgumentValue, buildConstValueNode, buildDocument, buildWithTypeModifier } from "./build-document";

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

describe("buildArgumentValue", () => {
  describe("with nested VarRefs", () => {
    it("builds correct AST when VarRef is nested in object", () => {
      const userIdRef = createVarRefFromVariable("userId");
      const nestedRef = createVarRefFromNestedValue({
        name: "Alice",
        id: userIdRef,
      });

      const result = buildArgumentValue(nestedRef);

      expect(result).toEqual({
        kind: Kind.OBJECT,
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "name" },
            value: { kind: Kind.STRING, value: "Alice" },
          },
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "id" },
            value: {
              kind: Kind.VARIABLE,
              name: { kind: Kind.NAME, value: "userId" },
            },
          },
        ],
      });
    });

    it("builds correct AST when VarRef is nested in array", () => {
      const userIdRef = createVarRefFromVariable("userId");
      const nestedRef = createVarRefFromNestedValue(["literal", userIdRef]);

      const result = buildArgumentValue(nestedRef);

      expect(result).toEqual({
        kind: Kind.LIST,
        values: [
          { kind: Kind.STRING, value: "literal" },
          {
            kind: Kind.VARIABLE,
            name: { kind: Kind.NAME, value: "userId" },
          },
        ],
      });
    });

    it("builds correct AST for deeply nested VarRefs", () => {
      const ageRef = createVarRefFromVariable("userAge");
      const nestedRef = createVarRefFromNestedValue({
        user: {
          profile: {
            age: ageRef,
            name: "Bob",
          },
        },
      });

      const result = buildArgumentValue(nestedRef);

      expect(result).toEqual({
        kind: Kind.OBJECT,
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "user" },
            value: {
              kind: Kind.OBJECT,
              fields: [
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "profile" },
                  value: {
                    kind: Kind.OBJECT,
                    fields: [
                      {
                        kind: Kind.OBJECT_FIELD,
                        name: { kind: Kind.NAME, value: "age" },
                        value: {
                          kind: Kind.VARIABLE,
                          name: { kind: Kind.NAME, value: "userAge" },
                        },
                      },
                      {
                        kind: Kind.OBJECT_FIELD,
                        name: { kind: Kind.NAME, value: "name" },
                        value: { kind: Kind.STRING, value: "Bob" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });
    });

    it("handles nested VarRef containing another nested-value", () => {
      const innerRef = createVarRefFromNestedValue({ inner: "value" });
      const outerRef = createVarRefFromNestedValue({
        outer: innerRef,
      });

      const result = buildArgumentValue(outerRef);

      expect(result).toEqual({
        kind: Kind.OBJECT,
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: "outer" },
            value: {
              kind: Kind.OBJECT,
              fields: [
                {
                  kind: Kind.OBJECT_FIELD,
                  name: { kind: Kind.NAME, value: "inner" },
                  value: { kind: Kind.STRING, value: "value" },
                },
              ],
            },
          },
        ],
      });
    });
  });

  describe("with variable VarRef", () => {
    it("builds GraphQL variable node", () => {
      const varRef = createVarRefFromVariable("userId");
      const result = buildArgumentValue(varRef);

      expect(result).toEqual({
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: "userId" },
      });
    });
  });

  describe("with primitive values", () => {
    it("returns null for undefined", () => {
      expect(buildArgumentValue(undefined)).toBeNull();
    });

    it("builds NULL node for null", () => {
      expect(buildArgumentValue(null)).toEqual({ kind: Kind.NULL });
    });

    it("builds STRING node for strings", () => {
      expect(buildArgumentValue("test")).toEqual({ kind: Kind.STRING, value: "test" });
    });

    it("builds INT node for integers", () => {
      expect(buildArgumentValue(42)).toEqual({ kind: Kind.INT, value: "42" });
    });

    it("builds FLOAT node for floats", () => {
      expect(buildArgumentValue(3.14)).toEqual({ kind: Kind.FLOAT, value: "3.14" });
    });

    it("builds BOOLEAN node for booleans", () => {
      expect(buildArgumentValue(true)).toEqual({ kind: Kind.BOOLEAN, value: true });
      expect(buildArgumentValue(false)).toEqual({ kind: Kind.BOOLEAN, value: false });
    });
  });
});

describe("DirectiveRef in buildDocument", () => {
  it("includes @skip directive on field", () => {
    const skipDirective = new DirectiveRef({
      name: "skip",
      arguments: { if: true },
      locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    });

    const fields = {
      user: {
        parent: "Query",
        field: "user",
        type: { kind: "object" as const, name: "User", modifier: "?" as const },
        args: {},
        directives: [],
        object: {
          id: {
            parent: "User",
            field: "id",
            type: { kind: "scalar" as const, name: "ID", modifier: "!" as const },
            args: {},
            directives: [],
            object: null,
            union: null,
          },
          email: {
            parent: "User",
            field: "email",
            type: { kind: "scalar" as const, name: "String", modifier: "?" as const },
            args: {},
            directives: [skipDirective],
            object: null,
            union: null,
          },
        },
        union: null,
      },
    };

    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const doc = buildDocument({
      operationName: "GetUser",
      operationType: "query",
      variables: {},
      fields: fields as any,
    });

    const printed = print(doc);
    expect(printed).toContain("@skip(if: true)");
    expect(printed).toContain("email @skip");
  });

  it("includes @include directive with variable reference", () => {
    const showEmailVar = createVarRefFromVariable("showEmail");
    const includeDirective = new DirectiveRef({
      name: "include",
      arguments: { if: showEmailVar },
      locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    });

    const fields = {
      user: {
        parent: "Query",
        field: "user",
        type: { kind: "object" as const, name: "User", modifier: "?" as const },
        args: {},
        directives: [],
        object: {
          id: {
            parent: "User",
            field: "id",
            type: { kind: "scalar" as const, name: "ID", modifier: "!" as const },
            args: {},
            directives: [],
            object: null,
            union: null,
          },
          email: {
            parent: "User",
            field: "email",
            type: { kind: "scalar" as const, name: "String", modifier: "?" as const },
            args: {},
            directives: [includeDirective],
            object: null,
            union: null,
          },
        },
        union: null,
      },
    };

    const variables = {
      showEmail: {
        kind: "scalar" as const,
        name: "Boolean",
        modifier: "!" as const,
        defaultValue: null,
        directives: {},
      },
    };

    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const doc = buildDocument({
      operationName: "GetUser",
      operationType: "query",
      variables,
      fields: fields as any,
    });

    const printed = print(doc);
    expect(printed).toContain("@include(if: $showEmail)");
    expect(printed).toContain("$showEmail: Boolean!");
  });

  it("throws error for directive with invalid location", () => {
    // Create a directive that only allows QUERY location
    const queryOnlyDirective = new DirectiveRef({
      name: "queryOnly",
      arguments: {},
      locations: ["QUERY"],
    });

    const fields = {
      user: {
        parent: "Query",
        field: "user",
        type: { kind: "object" as const, name: "User", modifier: "?" as const },
        args: {},
        directives: [queryOnlyDirective], // Invalid: FIELD location not allowed
        object: {
          id: {
            parent: "User",
            field: "id",
            type: { kind: "scalar" as const, name: "ID", modifier: "!" as const },
            args: {},
            directives: [],
            object: null,
            union: null,
          },
        },
        union: null,
      },
    };

    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      buildDocument({
        operationName: "GetUser",
        operationType: "query",
        variables: {},
        fields: fields as any,
      });
    }).toThrow("Directive @queryOnly cannot be used on FIELD");
  });

  it("supports multiple directives on same field", () => {
    const skipDirective = new DirectiveRef({
      name: "skip",
      arguments: { if: false },
      locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    });

    const includeDirective = new DirectiveRef({
      name: "include",
      arguments: { if: true },
      locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    });

    const fields = {
      user: {
        parent: "Query",
        field: "user",
        type: { kind: "object" as const, name: "User", modifier: "?" as const },
        args: {},
        directives: [],
        object: {
          name: {
            parent: "User",
            field: "name",
            type: { kind: "scalar" as const, name: "String", modifier: "?" as const },
            args: {},
            directives: [skipDirective, includeDirective],
            object: null,
            union: null,
          },
        },
        union: null,
      },
    };

    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const doc = buildDocument({
      operationName: "GetUser",
      operationType: "query",
      variables: {},
      fields: fields as any,
    });

    const printed = print(doc);
    expect(printed).toContain("@skip(if: false)");
    expect(printed).toContain("@include(if: true)");
  });

  it("ignores non-DirectiveRef values in directives array", () => {
    const validDirective = new DirectiveRef({
      name: "skip",
      arguments: { if: true },
      locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    });

    const fields = {
      user: {
        parent: "Query",
        field: "user",
        type: { kind: "object" as const, name: "User", modifier: "?" as const },
        args: {},
        directives: [
          "not a directive" as unknown,
          validDirective,
          { name: "fake" } as unknown,
          null as unknown,
        ],
        object: {
          id: {
            parent: "User",
            field: "id",
            type: { kind: "scalar" as const, name: "ID", modifier: "!" as const },
            args: {},
            directives: [],
            object: null,
            union: null,
          },
        },
        union: null,
      },
    };

    // Should not throw, only valid DirectiveRef is processed
    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const doc = buildDocument({
      operationName: "GetUser",
      operationType: "query",
      variables: {},
      fields: fields as any,
    });

    const printed = print(doc);
    expect(printed).toContain("@skip(if: true)");
    // Should only have one directive
    expect(printed.match(/@/g)?.length).toBe(1);
  });
});
