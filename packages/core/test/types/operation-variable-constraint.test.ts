/**
 * Type-level tests for Operation variable constraint safety.
 *
 * Validates that relaxing the Operation constraint from `AnyConstAssignableInput`
 * to `Record<string, unknown>` preserves VarRef rejection safety.
 *
 * @module
 */
import { describe, expect, test } from "bun:test";
import type { ConstValue } from "../../src/types/type-foundation/const-value";
import type { AnyVarRef, AnyVarRefBrand, VarRef } from "../../src/types/type-foundation/var-ref";
import type { Expect, Extends } from "./_helpers";

// --- VarRef is NOT assignable to ConstValue ---
// VarRef is a branded class; ConstValue only accepts primitives, objects of ConstValue, and arrays of ConstValue.
type _VarRefNotConstValue = Expect<Extends<AnyVarRef, ConstValue> extends true ? false : true>;

// --- VarRef is NOT assignable to Record<string, unknown> ---
// VarRef is a class instance with a private `inner` field and a branded symbol property.
// It does not satisfy the `Record<string, unknown>` index signature constraint
// because class instances are not plain objects with arbitrary string keys.
type _VarRefNotRecord = Expect<Extends<AnyVarRef, Record<string, unknown>> extends true ? false : true>;

// --- Concrete Input-like types satisfy Record<string, unknown> ---
type SampleInput = {
  readonly filter: { readonly name: { readonly _eq: string } };
  readonly limit: number;
};
type _InputSatisfiesRecord = Expect<Extends<SampleInput, Record<string, unknown>>>;

// --- Empty object (no-variable operations) satisfies Record<string, unknown> ---
type _EmptyObjSatisfiesRecord = Expect<Extends<{}, Record<string, unknown>>>;

// --- Objects with VarRef values are NOT assignable to ConstValue-based types ---
type ObjectWithVarRef = {
  readonly filter: VarRef<AnyVarRefBrand>;
};
type _VarRefInObjectNotConst = Expect<
  Extends<ObjectWithVarRef, { readonly [key: string]: ConstValue }> extends true ? false : true
>;

// --- Record<string, unknown> IS assignable to Record<string, unknown> (consumer dynamic filter pattern) ---
type _DynamicFilterAccepted = Expect<Extends<Record<string, unknown>, Record<string, unknown>>>;

// Runtime test to keep bun:test happy
describe("operation variable constraint (type-level)", () => {
  test("compile-time type assertions pass", () => {
    expect(true).toBe(true);
  });
});
