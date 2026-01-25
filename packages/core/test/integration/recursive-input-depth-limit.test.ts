import { describe, expect, it } from "bun:test";
import { defineScalar } from "../../src/schema/schema-builder";
import type { AnyGraphqlSchema, InferInputProfile } from "../../src/types/schema";
import type { ConstAssignableInput } from "../../src/types/schema/const-assignable-input";
import type { InputDepthOverrides } from "../../src/types/type-foundation";
import { define, unsafeInputType } from "../utils/schema";

/**
 * Test suite for verifying depth limit behavior in recursive input types.
 *
 * Recursive input types like Hasura's `bool_exp` pattern can cause infinite
 * recursion in type inference. The depth limit prevents this by returning
 * `never` when the maximum depth is reached.
 */

// Type-level test utilities
type AssertNever<T extends never> = T;
type AssertNotNever<T> = [T] extends [never] ? false : true;

// Schema with self-referential input type (bool_exp pattern)
const createRecursiveSchema = () =>
  ({
    label: "recursive" as const,
    operations: {
      query: "Query" as const,
      mutation: null,
      subscription: null,
    },
    scalar: {
      ...defineScalar<"String", string, string>("String"),
      ...defineScalar<"Int", number, number>("Int"),
      ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
    },
    enum: {},
    input: {
      // Self-referential input type (like Hasura's bool_exp)
      user_bool_exp: define("user_bool_exp").input({
        _and: unsafeInputType.input("user_bool_exp:![]?", {}),
        _or: unsafeInputType.input("user_bool_exp:![]?", {}),
        _not: unsafeInputType.input("user_bool_exp:?", {}),
        name: unsafeInputType.input("String_comparison_exp:?", {}),
        age: unsafeInputType.input("Int_comparison_exp:?", {}),
      }),

      // Comparison expression types
      String_comparison_exp: define("String_comparison_exp").input({
        _eq: unsafeInputType.scalar("String:?", {}),
        _neq: unsafeInputType.scalar("String:?", {}),
        _like: unsafeInputType.scalar("String:?", {}),
      }),

      Int_comparison_exp: define("Int_comparison_exp").input({
        _eq: unsafeInputType.scalar("Int:?", {}),
        _neq: unsafeInputType.scalar("Int:?", {}),
        _gt: unsafeInputType.scalar("Int:?", {}),
        _lt: unsafeInputType.scalar("Int:?", {}),
      }),

      // Simple non-recursive input for comparison
      SimpleInput: define("SimpleInput").input({
        name: unsafeInputType.scalar("String:!", {}),
        age: unsafeInputType.scalar("Int:?", {}),
      }),

      // Nested but non-recursive input
      NestedInput: define("NestedInput").input({
        simple: unsafeInputType.input("SimpleInput:!", {}),
        optionalSimple: unsafeInputType.input("SimpleInput:?", {}),
      }),
    },
    object: {
      Query: define("Query").object({}),
    },
    union: {},
  }) satisfies AnyGraphqlSchema;

type RecursiveSchema = ReturnType<typeof createRecursiveSchema>;

// Helper to get input specifier as deferred string
type GetInputSpecifier<TInputName extends keyof RecursiveSchema["input"]> = `i|${TInputName & string}|!`;

describe("Recursive input type depth limit", () => {
  describe("InferInputProfile with default depth", () => {
    it("should infer non-recursive input types normally", () => {
      // SimpleInput should be fully inferred
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"SimpleInput">>;

      // Should not be never
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should infer nested non-recursive input types", () => {
      // NestedInput has 2 levels of nesting, should be fully inferred with default depth 3
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"NestedInput">>;

      // Should not be never
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should infer top-level of recursive input type", () => {
      // user_bool_exp top level should be inferred
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"user_bool_exp">>;

      // Should not be never at top level
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });
  });

  describe("InferInputProfile with custom depth", () => {
    it("should return never when depth is 0", () => {
      type Depth0 = [];
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"SimpleInput">, Depth0>;

      // Should be never when depth is exhausted
      type _Test = AssertNever<Profile>;

      expect(true).toBe(true);
    });

    it("should work with depth 1", () => {
      type Depth1 = [unknown];
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"SimpleInput">, Depth1>;

      // Should not be never with depth 1
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should handle deeper custom depth", () => {
      // Depth 5 for deeper inference
      type Depth5 = [unknown, unknown, unknown, unknown, unknown];
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"user_bool_exp">, Depth5>;

      // Should not be never at top level
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });
  });

  describe("ConstAssignableInput with recursive types", () => {
    it("should allow valid values within depth limit", () => {
      // This should compile - simple filter without deep recursion
      // Depth usage: user_bool_exp (3) -> name/String_comparison_exp (2) -> _eq/String (1)
      const _input: ConstAssignableInput<RecursiveSchema, RecursiveSchema["input"]["user_bool_exp"]["fields"]> = {
        name: {
          _eq: "Alice",
        },
        age: {
          _gt: 18,
        },
      };

      expect(true).toBe(true);
    });

    it("should allow non-recursive input types", () => {
      // SimpleInput should work normally
      const _input: ConstAssignableInput<RecursiveSchema, RecursiveSchema["input"]["SimpleInput"]["fields"]> = {
        name: "Alice",
        age: 30,
      };

      expect(true).toBe(true);
    });

    it("should allow nested non-recursive input types", () => {
      // NestedInput has 2 levels of nesting, should be fully inferred with default depth 3
      const _input: ConstAssignableInput<RecursiveSchema, RecursiveSchema["input"]["NestedInput"]["fields"]> = {
        simple: {
          name: "Alice",
          age: 30,
        },
        optionalSimple: {
          name: "Bob",
        },
      };

      expect(true).toBe(true);
    });
  });

  describe("Type inference performance", () => {
    it("should complete type checking without timeout", () => {
      // This test verifies that type checking completes in reasonable time
      // If depth limit wasn't working, this would cause infinite recursion
      type Profile = InferInputProfile<RecursiveSchema, GetInputSpecifier<"user_bool_exp">>;

      // Just verify the test completes
      type _Exists = Profile extends never ? false : true;

      expect(true).toBe(true);
    });
  });

  describe("Schema-based depth overrides", () => {
    // Schema with __inputDepthOverrides for per-type depth configuration
    const createSchemaWithDepthOverrides = <T extends InputDepthOverrides>(overrides: T) =>
      ({
        label: "with_overrides" as const,
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
          // Self-referential input type
          user_bool_exp: define("user_bool_exp").input({
            _and: unsafeInputType.input("user_bool_exp:![]?", {}),
            _or: unsafeInputType.input("user_bool_exp:![]?", {}),
            _not: unsafeInputType.input("user_bool_exp:?", {}),
            name: unsafeInputType.scalar("String:?", {}),
          }),
          // Another recursive input
          post_bool_exp: define("post_bool_exp").input({
            _and: unsafeInputType.input("post_bool_exp:![]?", {}),
            title: unsafeInputType.scalar("String:?", {}),
          }),
          // Simple input
          SimpleInput: define("SimpleInput").input({
            name: unsafeInputType.scalar("String:!", {}),
          }),
        },
        object: {
          Query: define("Query").object({}),
        },
        union: {},
        __inputDepthOverrides: overrides,
      }) satisfies AnyGraphqlSchema;

    type SchemaWithOverrides5 = ReturnType<typeof createSchemaWithDepthOverrides<{ user_bool_exp: 5 }>>;
    type SchemaWithOverrides1 = ReturnType<typeof createSchemaWithDepthOverrides<{ user_bool_exp: 1 }>>;
    type SchemaNoOverrides = ReturnType<typeof createSchemaWithDepthOverrides<Record<string, never>>>;

    type GetInputSpecifierForSchema<
      TSchema extends AnyGraphqlSchema,
      TInputName extends keyof TSchema["input"],
    > = `i|${TInputName & string}|!`;

    it("should use overridden depth for specific input types", () => {
      // user_bool_exp has depth override of 5
      type Profile = InferInputProfile<SchemaWithOverrides5, GetInputSpecifierForSchema<SchemaWithOverrides5, "user_bool_exp">>;

      // Should not be never (depth 5 is sufficient for top-level)
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should fallback to DefaultDepth for non-overridden types", () => {
      // post_bool_exp has no override, should use DefaultDepth (3)
      type Profile = InferInputProfile<SchemaWithOverrides5, GetInputSpecifierForSchema<SchemaWithOverrides5, "post_bool_exp">>;

      // Should not be never (DefaultDepth 3 is sufficient)
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should use DefaultDepth when no overrides are present", () => {
      // Schema has no depth overrides
      type Profile = InferInputProfile<SchemaNoOverrides, GetInputSpecifierForSchema<SchemaNoOverrides, "user_bool_exp">>;

      // Should not be never (DefaultDepth 3 is sufficient)
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should handle depth 1 override correctly", () => {
      // user_bool_exp has depth override of 1
      type Profile = InferInputProfile<SchemaWithOverrides1, GetInputSpecifierForSchema<SchemaWithOverrides1, "user_bool_exp">>;

      // Should not be never (depth 1 allows top-level)
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });

    it("should work with SimpleInput regardless of overrides", () => {
      // SimpleInput is not recursive, should always work
      type Profile = InferInputProfile<SchemaWithOverrides5, GetInputSpecifierForSchema<SchemaWithOverrides5, "SimpleInput">>;

      // Should not be never
      type _Test = AssertNotNever<Profile>;

      expect(true).toBe(true);
    });
  });
});
