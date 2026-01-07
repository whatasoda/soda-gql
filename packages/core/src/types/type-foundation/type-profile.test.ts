import { describe, expect, it } from "bun:test";
import { defineScalar, unsafeInputType } from "../../schema";
import { define } from "../../../test/utils/schema";
import type { AssignableInput } from "../fragment/assignable-input";
import type { AnyGraphqlSchema } from "../schema";
import type { ConstAssignableInput } from "../schema/const-assignable-input";
import { createVarRefFromVariable } from "./var-ref";

/**
 * Test suite for verifying optional field inference in nested Input objects.
 *
 * Problem: TypeProfile.Type and TypeProfile.AssignableType were treating all
 * nested Input object fields as required, even when they should be optional.
 *
 * Expected behavior:
 * - Fields with modifier ending in "?" should be optional
 * - Fields with defaultValue should be optional
 * - Fields with modifier ending in "!" and no defaultValue should be required
 */

// Test schema with various input configurations
const createTestSchema = () =>
  ({
    label: "test" as const,
    operations: {
      query: "Query" as const,
      mutation: null,
      subscription: null,
    },
    scalar: {
      ...defineScalar<"String", string, string>("String"),
      ...defineScalar<"Int", number, number>("Int"),
    },
    enum: {},
    input: {
      // Input with mixed required/optional fields
      MixedInput: define("MixedInput").input({
        required: unsafeInputType.scalar("String:!", {}),
        optional: unsafeInputType.scalar("String:?", {}),
        withDefault: unsafeInputType.scalar("String:!", { default: () => "default" }),
      }),

      // Nested input for testing deep optional handling
      OuterInput: define("OuterInput").input({
        requiredNested: unsafeInputType.input("InnerInput:!", {}),
        optionalNested: unsafeInputType.input("InnerInput:?", {}),
      }),

      InnerInput: define("InnerInput").input({
        requiredField: unsafeInputType.scalar("String:!", {}),
        optionalField: unsafeInputType.scalar("Int:?", {}),
      }),

      // All optional fields
      AllOptionalInput: define("AllOptionalInput").input({
        field1: unsafeInputType.scalar("String:?", {}),
        field2: unsafeInputType.scalar("Int:?", {}),
      }),

      // All required fields
      AllRequiredInput: define("AllRequiredInput").input({
        field1: unsafeInputType.scalar("String:!", {}),
        field2: unsafeInputType.scalar("Int:!", {}),
      }),
    },
    object: {
      Query: define("Query").object({}),
    },
    union: {},
  }) satisfies AnyGraphqlSchema;

type TestSchema = ReturnType<typeof createTestSchema>;

describe("Input object optional field inference", () => {
  describe("ConstAssignableInput", () => {
    it("should allow omitting optional fields", () => {
      // This should compile - optional fields can be omitted
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["MixedInput"]["fields"]> = {
        required: "value",
        // optional and withDefault can be omitted
      };
      expect(true).toBe(true);
    });

    it("should require required fields", () => {
      // @ts-expect-error - required field is missing
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["MixedInput"]["fields"]> = {
        optional: "value",
      };
      expect(true).toBe(true);
    });

    it("should allow providing all fields including optional ones", () => {
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["MixedInput"]["fields"]> = {
        required: "value",
        optional: "optional-value",
        withDefault: "custom-default",
      };
      expect(true).toBe(true);
    });

    it("should handle all-optional input", () => {
      // Empty object should be valid when all fields are optional
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["AllOptionalInput"]["fields"]> = {};
      expect(true).toBe(true);
    });

    it("should require all fields when all are required", () => {
      // @ts-expect-error - field2 is missing
      const _input1: ConstAssignableInput<TestSchema, TestSchema["input"]["AllRequiredInput"]["fields"]> = {
        field1: "value",
      };

      // @ts-expect-error - field1 is missing
      const _input2: ConstAssignableInput<TestSchema, TestSchema["input"]["AllRequiredInput"]["fields"]> = {
        field2: 42,
      };

      // This should work
      const _input3: ConstAssignableInput<TestSchema, TestSchema["input"]["AllRequiredInput"]["fields"]> = {
        field1: "value",
        field2: 42,
      };

      expect(true).toBe(true);
    });
  });

  describe("Nested Input objects", () => {
    it("should handle optional fields in nested input objects", () => {
      // requiredNested is required but optionalNested is optional
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["OuterInput"]["fields"]> = {
        requiredNested: {
          requiredField: "value",
          // optionalField can be omitted
        },
        // optionalNested can be omitted
      };
      expect(true).toBe(true);
    });

    it("should require nested required fields", () => {
      // @ts-expect-error - requiredNested is missing
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["OuterInput"]["fields"]> = {
        optionalNested: {
          requiredField: "value",
        },
      };
      expect(true).toBe(true);
    });

    it("should require required fields within nested input", () => {
      const _input: ConstAssignableInput<TestSchema, TestSchema["input"]["OuterInput"]["fields"]> = {
        // @ts-expect-error - requiredField is missing in requiredNested
        requiredNested: {},
      };
      expect(true).toBe(true);
    });
  });

  describe("AssignableInput (with VarRef support)", () => {
    it("should allow omitting optional fields", () => {
      const _input: AssignableInput<TestSchema, TestSchema["input"]["MixedInput"]["fields"]> = {
        required: "value",
        // optional and withDefault can be omitted
      };
      expect(true).toBe(true);
    });

    it("should require required fields", () => {
      // @ts-expect-error - required field is missing
      const _input: AssignableInput<TestSchema, TestSchema["input"]["MixedInput"]["fields"]> = {
        optional: "value",
      };
      expect(true).toBe(true);
    });

    it("should handle nested input with optional fields", () => {
      const _input: AssignableInput<TestSchema, TestSchema["input"]["OuterInput"]["fields"]> = {
        requiredNested: {
          requiredField: "value",
          // optionalField can be omitted
        },
        // optionalNested can be omitted
      };
      expect(true).toBe(true);
    });
  });
});

/**
 * Test suite for verifying VarRef assignment in nested Input objects.
 *
 * Problem: Nested input object fields could not accept VarRef because
 * ObjectTypeProfile lost the type name information.
 *
 * Expected behavior:
 * - VarRef should be assignable to nested input object fields
 * - VarRef for self-referential types like bool_exp should work
 */

// Schema with non-self-referential nested input types for basic verification
const createNestedInputSchema = () =>
  ({
    label: "nested_input_test" as const,
    operations: {
      query: "Query" as const,
      mutation: null,
      subscription: null,
    },
    scalar: {
      ...defineScalar<"String", string, string>("String"),
      ...defineScalar<"Int", number, number>("Int"),
    },
    enum: {},
    input: {
      // Outer input with nested input field
      OuterFilter: define("OuterFilter").input({
        innerFilter: unsafeInputType.input("InnerFilter:?", {}),
        innerFilterArray: unsafeInputType.input("InnerFilter:![]?", {}),
      }),
      InnerFilter: define("InnerFilter").input({
        value: unsafeInputType.scalar("String:!", {}),
        count: unsafeInputType.scalar("Int:?", {}),
      }),
    },
    object: {
      Query: define("Query").object({}),
    },
    union: {},
  }) satisfies AnyGraphqlSchema;

type NestedInputSchema = ReturnType<typeof createNestedInputSchema>;

describe("VarRef in nested input objects", () => {
  describe("Non-self-referential nested input types", () => {
    it("should allow VarRef for nested input object field", () => {
      // Create a VarRef - type safety is enforced at assignment site
      const innerFilterVarRef = createVarRefFromVariable("innerFilter");

      // This should compile - VarRef should be assignable to innerFilter field
      const _input: AssignableInput<NestedInputSchema, NestedInputSchema["input"]["OuterFilter"]["fields"]> = {
        innerFilter: innerFilterVarRef,
      };
      expect(true).toBe(true);
    });

    it("should allow VarRef for entire array field", () => {
      // VarRef for the whole array type
      const wholeArrayVarRef = createVarRefFromVariable("wholeArray");

      // This should compile - VarRef for entire array should work
      const _input: AssignableInput<NestedInputSchema, NestedInputSchema["input"]["OuterFilter"]["fields"]> = {
        innerFilterArray: wholeArrayVarRef,
      };
      expect(true).toBe(true);
    });

    it("should allow VarRef at array element level", () => {
      // VarRef for array element
      const elementVarRef = createVarRefFromVariable("element");

      // This should compile - VarRef in array element position should work
      const _input: AssignableInput<NestedInputSchema, NestedInputSchema["input"]["OuterFilter"]["fields"]> = {
        innerFilterArray: [elementVarRef],
      };
      expect(true).toBe(true);
    });

    it("should allow mixed const values and VarRef in nested array", () => {
      const innerFilterVarRef = createVarRefFromVariable("innerFilter");

      // This should compile - mixing const with VarRef
      const _input: AssignableInput<NestedInputSchema, NestedInputSchema["input"]["OuterFilter"]["fields"]> = {
        innerFilterArray: [{ value: "const1" }, innerFilterVarRef, { value: "const2", count: 5 }],
      };
      expect(true).toBe(true);
    });

    // Note: Type-level rejection tests are no longer applicable since
    // createVarRefFromVariable now returns AnyVarRef. Type safety for
    // VarRef assignment is enforced at the AssigningInput level, not
    // at VarRef creation time.
  });
});
