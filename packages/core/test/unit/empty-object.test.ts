import { describe, expect, it } from "bun:test";
import type { IfOmittable, OptionalArg, SwitchIfOmittable } from "../../src/utils/empty-object";

/**
 * Type tests for omittable object utilities.
 *
 * IsOmittable uses `{} extends T` pattern to detect:
 * - Empty objects (no properties)
 * - Objects where all properties are optional
 */

// Type-level test helpers
type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("IsOmittable / IfOmittable / SwitchIfOmittable", () => {
  describe("empty object detection", () => {
    it("should detect empty object as omittable", () => {
      type EmptyObj = {};
      type Result = SwitchIfOmittable<EmptyObj, "omittable", "required">;
      type _Test = Expect<Equal<Result, "omittable">>;

      expect(true).toBe(true);
    });

    it("should detect object with required property as not omittable", () => {
      type ObjWithRequired = { foo: string };
      type Result = SwitchIfOmittable<ObjWithRequired, "omittable", "required">;
      type _Test = Expect<Equal<Result, "required">>;

      expect(true).toBe(true);
    });
  });

  describe("all-optional object detection", () => {
    it("should detect object with all optional properties as omittable", () => {
      type AllOptional = { foo?: string; bar?: number };
      type Result = SwitchIfOmittable<AllOptional, "omittable", "required">;
      type _Test = Expect<Equal<Result, "omittable">>;

      expect(true).toBe(true);
    });

    it("should detect object with single optional property as omittable", () => {
      type SingleOptional = { foo?: string };
      type Result = SwitchIfOmittable<SingleOptional, "omittable", "required">;
      type _Test = Expect<Equal<Result, "omittable">>;

      expect(true).toBe(true);
    });
  });

  describe("mixed required/optional object detection", () => {
    it("should detect object with mixed properties as not omittable", () => {
      type MixedObj = { required: string; optional?: number };
      type Result = SwitchIfOmittable<MixedObj, "omittable", "required">;
      type _Test = Expect<Equal<Result, "required">>;

      expect(true).toBe(true);
    });
  });

  describe("IfOmittable utility", () => {
    it("should return provided type for empty object", () => {
      type EmptyObj = {};
      type Result = IfOmittable<EmptyObj, "fallback">;
      type _Test = Expect<Equal<Result, "fallback">>;

      expect(true).toBe(true);
    });

    it("should return never for non-omittable object", () => {
      type NonEmpty = { foo: string };
      type Result = IfOmittable<NonEmpty, "fallback">;
      type _Test = Expect<Equal<Result, never>>;

      expect(true).toBe(true);
    });

    it("should return provided type for all-optional object", () => {
      type AllOptional = { foo?: string };
      type Result = IfOmittable<AllOptional, "fallback">;
      type _Test = Expect<Equal<Result, "fallback">>;

      expect(true).toBe(true);
    });
  });

  describe("OptionalArg utility", () => {
    it("should return void for empty object", () => {
      type EmptyObj = {};
      type Result = OptionalArg<EmptyObj>;
      type _Test = Expect<Equal<Result, void>>;

      expect(true).toBe(true);
    });

    it("should return T | void for all-optional object (can omit or provide)", () => {
      type AllOptional = { foo?: string; bar?: number };
      type Result = OptionalArg<AllOptional>;
      type _Test = Expect<Equal<Result, AllOptional | void>>;

      expect(true).toBe(true);
    });

    it("should return T for object with required fields (must provide)", () => {
      type WithRequired = { foo: string; bar?: number };
      type Result = OptionalArg<WithRequired>;
      type _Test = Expect<Equal<Result, WithRequired>>;

      expect(true).toBe(true);
    });
  });
});
