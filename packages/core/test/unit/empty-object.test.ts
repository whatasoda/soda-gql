import { describe, expect, it } from "bun:test";
import type { IfEmpty, SwitchIfEmpty } from "../../src/utils/empty-object";

/**
 * Type tests for empty-object utilities.
 *
 * IsEmptyObject uses `{} extends T` pattern to detect:
 * - Empty objects (no properties)
 * - Objects where all properties are optional
 */

// Type-level test helpers
type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("IsEmptyObject / IfEmpty / SwitchIfEmpty", () => {
  describe("empty object detection", () => {
    it("should detect empty object as empty", () => {
      type EmptyObj = {};
      type Result = SwitchIfEmpty<EmptyObj, "empty", "not-empty">;
      type _Test = Expect<Equal<Result, "empty">>;

      expect(true).toBe(true);
    });

    it("should detect object with required property as not empty", () => {
      type ObjWithRequired = { foo: string };
      type Result = SwitchIfEmpty<ObjWithRequired, "empty", "not-empty">;
      type _Test = Expect<Equal<Result, "not-empty">>;

      expect(true).toBe(true);
    });
  });

  describe("all-optional object detection", () => {
    it("should detect object with all optional properties as empty", () => {
      type AllOptional = { foo?: string; bar?: number };
      type Result = SwitchIfEmpty<AllOptional, "empty", "not-empty">;
      type _Test = Expect<Equal<Result, "empty">>;

      expect(true).toBe(true);
    });

    it("should detect object with single optional property as empty", () => {
      type SingleOptional = { foo?: string };
      type Result = SwitchIfEmpty<SingleOptional, "empty", "not-empty">;
      type _Test = Expect<Equal<Result, "empty">>;

      expect(true).toBe(true);
    });
  });

  describe("mixed required/optional object detection", () => {
    it("should detect object with mixed properties as not empty", () => {
      type MixedObj = { required: string; optional?: number };
      type Result = SwitchIfEmpty<MixedObj, "empty", "not-empty">;
      type _Test = Expect<Equal<Result, "not-empty">>;

      expect(true).toBe(true);
    });
  });

  describe("IfEmpty utility", () => {
    it("should return provided type for empty object", () => {
      type EmptyObj = {};
      type Result = IfEmpty<EmptyObj, "fallback">;
      type _Test = Expect<Equal<Result, "fallback">>;

      expect(true).toBe(true);
    });

    it("should return never for non-empty object", () => {
      type NonEmpty = { foo: string };
      type Result = IfEmpty<NonEmpty, "fallback">;
      type _Test = Expect<Equal<Result, never>>;

      expect(true).toBe(true);
    });

    it("should return provided type for all-optional object", () => {
      type AllOptional = { foo?: string };
      type Result = IfEmpty<AllOptional, "fallback">;
      type _Test = Expect<Equal<Result, "fallback">>;

      expect(true).toBe(true);
    });
  });
});
