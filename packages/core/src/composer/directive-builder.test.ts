import { describe, it, expect } from "bun:test";
import { DirectiveRef } from "../types/type-foundation/directive-ref";
import {
  createDirectiveMethod,
  createStandardDirectives,
  createDirectiveBuilder,
  isDirectiveRef,
} from "./directive-builder";

describe("directive-builder", () => {
  describe("createDirectiveMethod", () => {
    it("creates a directive method that produces DirectiveRef", () => {
      const skipMethod = createDirectiveMethod("skip", ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"] as const);
      const result = skipMethod({ if: true });

      expect(result).toBeInstanceOf(DirectiveRef);

      const inner = DirectiveRef.getInner(result);
      expect(inner.name).toBe("skip");
      expect(inner.arguments).toEqual({ if: true });
      expect(inner.locations).toEqual(["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"]);
    });

    it("preserves argument values including complex types", () => {
      const customMethod = createDirectiveMethod("custom", ["FIELD"] as const);
      const result = customMethod({
        stringArg: "value",
        numberArg: 42,
        boolArg: false,
        nullArg: null,
      });

      const inner = DirectiveRef.getInner(result);
      expect(inner.arguments).toEqual({
        stringArg: "value",
        numberArg: 42,
        boolArg: false,
        nullArg: null,
      });
    });
  });

  describe("createStandardDirectives", () => {
    it("creates skip directive method", () => {
      const directives = createStandardDirectives();
      const skipDirective = directives.skip({ if: true });

      expect(skipDirective).toBeInstanceOf(DirectiveRef);

      const inner = DirectiveRef.getInner(skipDirective);
      expect(inner.name).toBe("skip");
      expect(inner.locations).toContain("FIELD");
      expect(inner.locations).toContain("FRAGMENT_SPREAD");
      expect(inner.locations).toContain("INLINE_FRAGMENT");
    });

    it("creates include directive method", () => {
      const directives = createStandardDirectives();
      const includeDirective = directives.include({ if: false });

      expect(includeDirective).toBeInstanceOf(DirectiveRef);

      const inner = DirectiveRef.getInner(includeDirective);
      expect(inner.name).toBe("include");
      expect(inner.locations).toContain("FIELD");
    });
  });

  describe("createDirectiveBuilder", () => {
    it("includes standard directives", () => {
      const builder = createDirectiveBuilder();

      expect(builder.skip).toBeDefined();
      expect(builder.include).toBeDefined();
    });

    it("merges custom directives with standard ones", () => {
      const customDirectives = {
        cached: createDirectiveMethod("cached", ["FIELD"] as const),
      };
      const builder = createDirectiveBuilder(customDirectives);

      expect(builder.skip).toBeDefined();
      expect(builder.include).toBeDefined();
      expect(builder.cached).toBeDefined();

      const cachedDirective = builder.cached({ ttl: 3600 });
      const inner = DirectiveRef.getInner(cachedDirective);
      expect(inner.name).toBe("cached");
      expect(inner.arguments).toEqual({ ttl: 3600 });
    });
  });

  describe("isDirectiveRef", () => {
    it("returns true for DirectiveRef instances", () => {
      const directives = createStandardDirectives();
      const skipDirective = directives.skip({ if: true });

      expect(isDirectiveRef(skipDirective)).toBe(true);
    });

    it("returns false for non-DirectiveRef values", () => {
      expect(isDirectiveRef(null)).toBe(false);
      expect(isDirectiveRef(undefined)).toBe(false);
      expect(isDirectiveRef({})).toBe(false);
      expect(isDirectiveRef("skip")).toBe(false);
      expect(isDirectiveRef({ name: "skip", arguments: {} })).toBe(false);
    });
  });
});
