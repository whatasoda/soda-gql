import { describe, expect, it } from "bun:test";
import {
  createVarRefFromNestedValue,
  createVarRefFromNestedValueV2,
  createVarRefFromVariable,
  createVarRefFromVariableV2,
  getNameAt,
  getValueAt,
  getVariablePath,
  getVarRefName,
  getVarRefValue,
  hasVarRefInside,
  isVarRef,
} from "./var-ref";

describe("hasVarRefInside", () => {
  it("returns false for primitive values", () => {
    expect(hasVarRefInside("string")).toBe(false);
    expect(hasVarRefInside(123)).toBe(false);
    expect(hasVarRefInside(true)).toBe(false);
    expect(hasVarRefInside(null)).toBe(false);
    expect(hasVarRefInside(undefined)).toBe(false);
  });

  it("returns false for plain objects", () => {
    expect(hasVarRefInside({ name: "Alice", age: 30 })).toBe(false);
  });

  it("returns false for plain arrays", () => {
    expect(hasVarRefInside([1, 2, 3])).toBe(false);
    expect(hasVarRefInside(["a", "b", "c"])).toBe(false);
  });

  it("returns true when VarRef is at root", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(hasVarRefInside(varRef)).toBe(true);
  });

  it("returns true when VarRef is nested in object", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(hasVarRefInside({ user: { id: varRef } })).toBe(true);
  });

  it("returns true when VarRef is nested in array", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(hasVarRefInside([1, varRef, 3])).toBe(true);
  });

  it("returns true for deeply nested VarRef", () => {
    const varRef = createVarRefFromVariable("deep");
    expect(hasVarRefInside({ a: { b: { c: [{ d: varRef }] } } })).toBe(true);
  });
});

describe("getVarRefValue", () => {
  it("returns value for nested object without VarRef", () => {
    const varRef = createVarRefFromNestedValue({ name: "Alice", age: 30 });
    expect(getVarRefValue(varRef)).toEqual({ name: "Alice", age: 30 });
  });

  it("throws for variable type", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(() => getVarRefValue(varRef)).toThrow("Expected nested-value, got variable reference");
  });

  it("throws when nested object contains VarRef", () => {
    const innerVarRef = createVarRefFromVariable("userId");
    const varRef = createVarRefFromNestedValue({ user: { id: innerVarRef } });
    expect(() => getVarRefValue(varRef)).toThrow("Cannot get const value: nested-value contains VarRef");
  });

  it("throws when nested array contains VarRef", () => {
    const innerVarRef = createVarRefFromVariable("userId");
    const varRef = createVarRefFromNestedValue([1, innerVarRef, 3]);
    expect(() => getVarRefValue(varRef)).toThrow("Cannot get const value: nested-value contains VarRef");
  });
});

describe("getVarRefName", () => {
  it("returns variable name", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(getVarRefName(varRef)).toBe("userId");
  });

  it("throws for nested-value type", () => {
    const varRef = createVarRefFromNestedValue({ test: "value" });
    expect(() => getVarRefName(varRef)).toThrow("Expected variable reference, got nested-value");
  });
});

describe("isVarRef", () => {
  it("returns true for VarRef instances", () => {
    expect(isVarRef(createVarRefFromVariable("test"))).toBe(true);
    expect(isVarRef(createVarRefFromNestedValue({ test: "value" }))).toBe(true);
  });

  it("returns false for non-VarRef values", () => {
    expect(isVarRef("string")).toBe(false);
    expect(isVarRef(123)).toBe(false);
    expect(isVarRef(null)).toBe(false);
    expect(isVarRef(undefined)).toBe(false);
    expect(isVarRef({})).toBe(false);
    expect(isVarRef([])).toBe(false);
  });
});

describe("getNameAt", () => {
  it("extracts variable name from nested VarRef in object", () => {
    const innerVarRef = createVarRefFromVariable("userId");
    const varRef = createVarRefFromNestedValue({ user: { id: innerVarRef } });
    expect(getNameAt(varRef, (p: any) => p.user.id)).toBe("userId");
  });

  it("extracts variable name from nested VarRef in array", () => {
    const innerVarRef = createVarRefFromVariable("firstId");
    const varRef = createVarRefFromNestedValue({ ids: [innerVarRef, "literal"] });
    expect(getNameAt(varRef, (p: any) => p.ids[0])).toBe("firstId");
  });

  it("throws when trying to access children of variable VarRef", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(() => getNameAt(varRef, (p: any) => p.any)).toThrow("Value at path [any] is inside a variable");
  });

  it("throws when path leads to non-VarRef value", () => {
    const varRef = createVarRefFromNestedValue({ user: { name: "Alice" } });
    expect(() => getNameAt(varRef, (p: any) => p.user.name)).toThrow("Value at path [user.name] is not a variable");
  });

  it("throws when path leads to primitive inside nested-value", () => {
    const varRef = createVarRefFromNestedValue({ user: { name: "Alice" } });
    expect(() => getNameAt(varRef, (p: any) => p.user.name.foo)).toThrow(
      "Cannot access children of primitive value at path [user.name]",
    );
  });
});

describe("getValueAt", () => {
  it("extracts const value from nested object", () => {
    const varRef = createVarRefFromNestedValue({ user: { name: "Alice", age: 30 } });
    expect(getValueAt(varRef, (p: any) => p.user.name)).toBe("Alice");
    expect(getValueAt(varRef, (p: any) => p.user.age)).toBe(30);
  });

  it("throws when path leads to VarRef", () => {
    const innerVarRef = createVarRefFromVariable("userId");
    const varRef = createVarRefFromNestedValue({ user: { id: innerVarRef } });
    expect(() => getValueAt(varRef, (p: any) => p.user.id)).toThrow("Value at path [user.id] is not a nested-value");
  });

  it("throws when value at path contains nested VarRef", () => {
    const innerVarRef = createVarRefFromVariable("userId");
    const varRef = createVarRefFromNestedValue({ user: { profile: { id: innerVarRef } } });
    expect(() => getValueAt(varRef, (p: any) => p.user)).toThrow("Value at path [user] contains nested VarRef");
  });

  it("throws when trying to access children of variable VarRef", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(() => getValueAt(varRef, (p: any) => p.any)).toThrow("Value at path [any] is inside a variable");
  });
});

describe("getVariablePath", () => {
  it("returns path with variable name for direct variable reference", () => {
    const varRef = createVarRefFromVariable("userId");
    expect(getVariablePath(varRef, (p: any) => p)).toEqual(["$userId"]);
  });

  it("returns path segments when accessing inside a variable", () => {
    const varRef = createVarRefFromVariable("user");
    // Returns variable name + path after the variable reference point
    expect(getVariablePath(varRef, (p: any) => p.profile.name)).toEqual(["$user", "name"]);
  });

  it("returns variable path from nested VarRef in object", () => {
    const innerVarRef = createVarRefFromVariable("userId");
    const varRef = createVarRefFromNestedValue({ user: { id: innerVarRef } });
    expect(getVariablePath(varRef, (p: any) => p.user.id)).toEqual(["$userId"]);
  });

  it("returns path for variable inside nested-value with further path access", () => {
    const innerVarRef = createVarRefFromVariable("user");
    const varRef = createVarRefFromNestedValue({ data: { profile: innerVarRef } });
    // Returns variable name + path after the variable reference point
    expect(getVariablePath(varRef, (p: any) => p.data.profile.name)).toEqual(["$user"]);
  });

  it("throws when path leads to non-variable value", () => {
    const varRef = createVarRefFromNestedValue({ user: { name: "Alice" } });
    expect(() => getVariablePath(varRef, (p: any) => p.user.name)).toThrow(
      "Value at path [user.name] is not a variable or inside a variable",
    );
  });
});

// ============================================================================
// V2 Functions Tests
// ============================================================================

describe("createVarRefFromVariableV2", () => {
  it("creates a VarRef from variable name", () => {
    const varRef = createVarRefFromVariableV2<"String", "scalar", "[TYPE_SIGNATURE]">("userId");
    expect(isVarRef(varRef)).toBe(true);
    expect(getVarRefName(varRef)).toBe("userId");
  });

  it("works with different type kinds", () => {
    const scalarRef = createVarRefFromVariableV2<"String", "scalar", "[TYPE_SIGNATURE]">("name");
    const enumRef = createVarRefFromVariableV2<"Status", "enum", "[TYPE_SIGNATURE]">("status");
    const inputRef = createVarRefFromVariableV2<"UserInput", "input", "[TYPE_SIGNATURE]">("user");

    expect(isVarRef(scalarRef)).toBe(true);
    expect(isVarRef(enumRef)).toBe(true);
    expect(isVarRef(inputRef)).toBe(true);
  });
});

describe("createVarRefFromNestedValueV2", () => {
  it("creates a VarRef from nested value", () => {
    const varRef = createVarRefFromNestedValueV2<"UserInput", "input", "[TYPE_SIGNATURE]">({
      name: "Alice",
      age: 30,
    });
    expect(isVarRef(varRef)).toBe(true);
    expect(getVarRefValue(varRef)).toEqual({ name: "Alice", age: 30 });
  });

  it("works with nested VarRefs inside", () => {
    const innerVarRef = createVarRefFromVariableV2<"String", "scalar", "[TYPE_SIGNATURE]">("userId");
    const varRef = createVarRefFromNestedValueV2<"UserInput", "input", "[TYPE_SIGNATURE]">({
      user: { id: innerVarRef, name: "Alice" },
    });
    expect(isVarRef(varRef)).toBe(true);
    // getVarRefValue throws when nested value contains VarRef
    expect(() => getVarRefValue(varRef)).toThrow("Cannot get const value: nested-value contains VarRef");
  });
});
