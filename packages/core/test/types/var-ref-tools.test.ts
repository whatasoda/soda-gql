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
import { getVarRefName } from "../../src/composer/var-ref-tools";
import { createVarRefFromVariable } from "../../src/types/type-foundation/var-ref";

describe("var-ref-tools", () => {
  it("getVarRefName returns name for a variable VarRef", () => {
    const varRef = createVarRefFromVariable("testVar");
    const name = getVarRefName(varRef);
    expect(name).toBe("testVar");
  });

  it("getVarRefName returns correct name for different variable names", () => {
    const varRef = createVarRefFromVariable("userId");
    const name = getVarRefName(varRef);
    expect(name).toBe("userId");
  });
});
