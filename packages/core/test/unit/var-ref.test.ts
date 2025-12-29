import { describe, expect, it } from "bun:test";
import {
  createVarRefFromNestedValue,
  createVarRefFromVariable,
  extractPath,
  getVarRefName,
  getVarRefValue,
  hasVarRefInside,
  isVarRef,
} from "../../src/types/type-foundation/var-ref";

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
  it("returns value for plain ConstValue", () => {
    const varRef = createVarRefFromNestedValue("test");
    expect(getVarRefValue(varRef)).toBe("test");
  });

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
    const varRef = createVarRefFromNestedValue("test");
    expect(() => getVarRefName(varRef)).toThrow("Expected variable reference, got nested-value");
  });
});

describe("isVarRef", () => {
  it("returns true for VarRef instances", () => {
    expect(isVarRef(createVarRefFromVariable("test"))).toBe(true);
    expect(isVarRef(createVarRefFromNestedValue("test"))).toBe(true);
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

describe("extractPath", () => {
  it("captures single property access", () => {
    expect(extractPath((p) => p.user)).toEqual(["user"]);
  });

  it("captures nested property access", () => {
    expect(extractPath((p) => p.user.profile.name)).toEqual(["user", "profile", "name"]);
  });

  it("captures array index access", () => {
    expect(extractPath((p) => p.items[0])).toEqual(["items", 0]);
  });

  it("captures mixed property and index access", () => {
    expect(extractPath((p) => p.users[0].addresses[1].street)).toEqual(["users", 0, "addresses", 1, "street"]);
  });

  it("returns empty array for identity function", () => {
    expect(extractPath((p) => p)).toEqual([]);
  });
});
