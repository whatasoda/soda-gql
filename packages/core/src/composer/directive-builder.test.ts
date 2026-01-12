import { describe, expect, it } from "bun:test";
import { DirectiveRef, type TypeSystemDirectiveLocation } from "../types/type-foundation/directive-ref";
import {
  createDirectiveBuilder,
  createDirectiveMethod,
  createStandardDirectives,
  createTypedDirectiveMethod,
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

  describe("createTypedDirectiveMethod", () => {
    it("creates directive method with argument specifiers", () => {
      const authMethod = createTypedDirectiveMethod("auth", ["FIELD"] as const, {
        role: { kind: "enum", name: "Role", modifier: "!" },
      });
      const result = authMethod({ role: "ADMIN" });

      expect(result).toBeInstanceOf(DirectiveRef);

      const inner = DirectiveRef.getInner(result);
      expect(inner.name).toBe("auth");
      expect(inner.arguments).toEqual({ role: "ADMIN" });
      expect(inner.locations).toEqual(["FIELD"]);
      expect(inner.argumentSpecs).toEqual({
        role: { kind: "enum", name: "Role", modifier: "!" },
      });
    });

    it("preserves multiple argument specifiers", () => {
      const cachedMethod = createTypedDirectiveMethod("cached", ["FIELD"] as const, {
        ttl: { kind: "scalar", name: "Int", modifier: "!" },
        scope: { kind: "enum", name: "CacheScope", modifier: "?" },
      });
      const result = cachedMethod({ ttl: 3600, scope: "PRIVATE" });

      const inner = DirectiveRef.getInner(result);
      expect(inner.argumentSpecs).toEqual({
        ttl: { kind: "scalar", name: "Int", modifier: "!" },
        scope: { kind: "enum", name: "CacheScope", modifier: "?" },
      });
    });
  });

  describe("TypeSystemDirectiveLocation support", () => {
    it("supports OBJECT and INTERFACE locations", () => {
      const authMethod = createDirectiveMethod("auth", ["FIELD", "OBJECT", "INTERFACE"] as const);
      const result = authMethod({ role: "admin" });

      const inner = DirectiveRef.getInner(result);
      expect(inner.name).toBe("auth");
      expect(inner.locations).toEqual(["FIELD", "OBJECT", "INTERFACE"]);
    });

    it("supports FIELD_DEFINITION location", () => {
      const deprecatedMethod = createDirectiveMethod("deprecated", ["FIELD_DEFINITION"] as const);
      const result = deprecatedMethod({ reason: "Use newField instead" });

      const inner = DirectiveRef.getInner(result);
      expect(inner.locations).toEqual(["FIELD_DEFINITION"]);
    });

    it("supports all TypeSystemDirectiveLocation values", () => {
      const allTypeSystemLocations = [
        "SCHEMA",
        "SCALAR",
        "OBJECT",
        "FIELD_DEFINITION",
        "ARGUMENT_DEFINITION",
        "INTERFACE",
        "UNION",
        "ENUM",
        "ENUM_VALUE",
        "INPUT_OBJECT",
        "INPUT_FIELD_DEFINITION",
      ] as const;

      const schemaDirectiveMethod = createDirectiveMethod("schemaDirective", allTypeSystemLocations);
      const result = schemaDirectiveMethod({});

      const inner = DirectiveRef.getInner(result);
      expect(inner.locations).toEqual([...allTypeSystemLocations]);
    });
  });
});
