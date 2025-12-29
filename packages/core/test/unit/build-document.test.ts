import { describe, expect, it } from "bun:test";
import { Kind } from "graphql";
import { buildArgumentValue } from "../../src/composer/build-document";
import { createVarRefFromNestedValue, createVarRefFromVariable } from "../../src/types/type-foundation/var-ref";

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
