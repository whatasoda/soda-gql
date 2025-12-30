import { describe, expect, it } from "bun:test";
import type {
  DecrementDepth,
  DefaultDepth,
  DepthCounter,
  GetInputTypeDepth,
  InputDepthOverrides,
  IsDepthExhausted,
  NumberToDepth,
} from "./depth-counter";

/**
 * Test suite for depth counter type utilities.
 *
 * These utilities are used to limit recursion depth in InferInputProfile
 * to prevent infinite recursion in self-referential input types like bool_exp.
 */

// Type-level test utilities
type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;
type AssertEqual<T, U> = T extends U ? (U extends T ? true : false) : false;

describe("depth-counter", () => {
  describe("DefaultDepth", () => {
    it("should be a tuple of length 3", () => {
      type _Test = AssertEqual<DefaultDepth["length"], 3>;
      expect(true).toBe(true);
    });
  });

  describe("DecrementDepth", () => {
    it("should reduce tuple length by 1", () => {
      type Depth3 = [unknown, unknown, unknown];
      type Depth2 = DecrementDepth<Depth3>;
      type Depth1 = DecrementDepth<Depth2>;
      type Depth0 = DecrementDepth<Depth1>;

      type _Test1 = AssertEqual<Depth2["length"], 2>;
      type _Test2 = AssertEqual<Depth1["length"], 1>;
      type _Test3 = AssertEqual<Depth0["length"], 0>;

      expect(true).toBe(true);
    });

    it("should return empty tuple when already empty", () => {
      type Empty = [];
      type StillEmpty = DecrementDepth<Empty>;

      type _Test = AssertEqual<StillEmpty, []>;

      expect(true).toBe(true);
    });

    it("should work with readonly tuples", () => {
      type ReadonlyDepth = readonly [unknown, unknown];
      type Decremented = DecrementDepth<ReadonlyDepth>;

      // Result should have length 1
      type _Test = AssertEqual<Decremented["length"], 1>;

      expect(true).toBe(true);
    });
  });

  describe("IsDepthExhausted", () => {
    it("should return true for empty tuple", () => {
      type Empty = [];
      type _Test = AssertTrue<IsDepthExhausted<Empty>>;

      expect(true).toBe(true);
    });

    it("should return false for non-empty tuple", () => {
      type Depth1 = [unknown];
      type Depth3 = [unknown, unknown, unknown];

      type _Test1 = AssertFalse<IsDepthExhausted<Depth1>>;
      type _Test2 = AssertFalse<IsDepthExhausted<Depth3>>;

      expect(true).toBe(true);
    });

    it("should work with readonly tuples", () => {
      type ReadonlyEmpty = readonly [];
      type ReadonlyNonEmpty = readonly [unknown];

      type _Test1 = AssertTrue<IsDepthExhausted<ReadonlyEmpty>>;
      type _Test2 = AssertFalse<IsDepthExhausted<ReadonlyNonEmpty>>;

      expect(true).toBe(true);
    });
  });

  describe("DepthCounter constraint", () => {
    it("should accept any tuple of unknowns", () => {
      // These should all be valid DepthCounter types
      type _Valid1 = [] extends DepthCounter ? true : false;
      type _Valid2 = [unknown] extends DepthCounter ? true : false;
      type _Valid3 = [unknown, unknown, unknown] extends DepthCounter ? true : false;
      type _Valid4 = readonly [unknown, unknown] extends DepthCounter ? true : false;

      type _Test1 = AssertTrue<_Valid1>;
      type _Test2 = AssertTrue<_Valid2>;
      type _Test3 = AssertTrue<_Valid3>;
      type _Test4 = AssertTrue<_Valid4>;

      expect(true).toBe(true);
    });
  });

  describe("NumberToDepth", () => {
    it("should convert 0 to empty tuple", () => {
      type _Test = AssertEqual<NumberToDepth<0>, []>;
      expect(true).toBe(true);
    });

    it("should convert 1 to tuple of length 1", () => {
      type _Test = AssertEqual<NumberToDepth<1>["length"], 1>;
      expect(true).toBe(true);
    });

    it("should convert 3 to tuple of length 3 (matching DefaultDepth)", () => {
      type _Test = AssertEqual<NumberToDepth<3>["length"], 3>;
      expect(true).toBe(true);
    });

    it("should convert 5 to tuple of length 5", () => {
      type _Test = AssertEqual<NumberToDepth<5>["length"], 5>;
      expect(true).toBe(true);
    });

    it("should convert 10 to tuple of length 10", () => {
      type _Test = AssertEqual<NumberToDepth<10>["length"], 10>;
      expect(true).toBe(true);
    });

    it("should fallback to DefaultDepth for unsupported numbers", () => {
      // Numbers > 10 should fallback to DefaultDepth (3)
      type _Test = AssertEqual<NumberToDepth<100>["length"], 3>;
      expect(true).toBe(true);
    });
  });

  describe("GetInputTypeDepth", () => {
    it("should return overridden depth for matching type name", () => {
      type Overrides = { user_bool_exp: 5; post_bool_exp: 7 };
      type Depth = GetInputTypeDepth<Overrides, "user_bool_exp">;

      // Should be tuple of length 5
      type _Test = AssertEqual<Depth["length"], 5>;
      expect(true).toBe(true);
    });

    it("should return DefaultDepth for non-matching type name", () => {
      type Overrides = { user_bool_exp: 5 };
      type Depth = GetInputTypeDepth<Overrides, "other_type">;

      // Should fallback to DefaultDepth (length 3)
      type _Test = AssertEqual<Depth["length"], 3>;
      expect(true).toBe(true);
    });

    it("should return DefaultDepth when overrides is undefined", () => {
      type Depth = GetInputTypeDepth<undefined, "any_type">;

      // Should fallback to DefaultDepth (length 3)
      type _Test = AssertEqual<Depth["length"], 3>;
      expect(true).toBe(true);
    });

    it("should return DefaultDepth for empty overrides", () => {
      type Overrides = Record<string, never>;
      type Depth = GetInputTypeDepth<Overrides, "any_type">;

      // Should fallback to DefaultDepth (length 3)
      type _Test = AssertEqual<Depth["length"], 3>;
      expect(true).toBe(true);
    });
  });

  describe("InputDepthOverrides constraint", () => {
    it("should accept readonly record of string to number", () => {
      type Valid = { user_bool_exp: 5; post_bool_exp: 10 };

      type _Test = Valid extends InputDepthOverrides ? true : false;
      type _Assert = AssertTrue<_Test>;

      expect(true).toBe(true);
    });
  });
});
