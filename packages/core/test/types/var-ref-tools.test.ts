/**
 * Type-level tests for var-ref-tools inference.
 *
 * Tests that getValueAt and getNameAt work with VarRef.
 * Note: After the syntax reform, metadata callbacks receive `any`-typed context,
 * so these tests verify runtime behavior rather than deep type inference.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import { getNameAt, getValueAt } from "../../src/composer/var-ref-tools";
import { createVarRefFromVariable, VarRef } from "../../src/types/type-foundation/var-ref";

describe("var-ref-tools", () => {
  it("getValueAt returns value for a simple VarRef", () => {
    const varRef = createVarRefFromVariable("testVar");
    const value = getValueAt(varRef, (p: { value: string }) => p.value);
    expect(typeof value).toBe("string");
  });

  it("getNameAt returns name string for VarRef", () => {
    const varRef = createVarRefFromVariable("testVar");
    const name = getNameAt(varRef, (p: { value: string }) => p.value);
    expect(typeof name).toBe("string");
  });
});
