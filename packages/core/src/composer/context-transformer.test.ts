import { afterEach, describe, expect, it } from "bun:test";
import {
  applyContextTransformer,
  clearContextTransformer,
  getContextTransformer,
  setContextTransformer,
} from "./context-transformer";

describe("context-transformer", () => {
  afterEach(() => {
    // Ensure clean state between tests
    clearContextTransformer();
  });

  describe("setContextTransformer / getContextTransformer", () => {
    it("should return null when no transformer is set", () => {
      expect(getContextTransformer()).toBeNull();
    });

    it("should store and retrieve transformer", () => {
      const transformer = (ctx: Record<string, unknown>) => ({ ...ctx, added: true });
      setContextTransformer(transformer);
      expect(getContextTransformer()).toBe(transformer);
    });

    it("should replace previous transformer", () => {
      const transformer1 = (ctx: Record<string, unknown>) => ({ ...ctx, v: 1 });
      const transformer2 = (ctx: Record<string, unknown>) => ({ ...ctx, v: 2 });

      setContextTransformer(transformer1);
      setContextTransformer(transformer2);

      expect(getContextTransformer()).toBe(transformer2);
    });
  });

  describe("clearContextTransformer", () => {
    it("should clear the transformer", () => {
      const transformer = (ctx: Record<string, unknown>) => ctx;
      setContextTransformer(transformer);
      expect(getContextTransformer()).toBe(transformer);

      clearContextTransformer();
      expect(getContextTransformer()).toBeNull();
    });

    it("should be safe to call when no transformer is set", () => {
      clearContextTransformer();
      expect(getContextTransformer()).toBeNull();
    });
  });

  describe("applyContextTransformer", () => {
    it("should return original context when no transformer is set", () => {
      const context = { foo: "bar", num: 42 };
      const result = applyContextTransformer(context);
      expect(result).toBe(context);
    });

    it("should apply transformer when set", () => {
      const transformer = (ctx: Record<string, unknown>) => ({
        ...ctx,
        injected: "value",
      });
      setContextTransformer(transformer);

      const context: Record<string, unknown> = { existing: "data" };
      const result = applyContextTransformer(context);

      expect(result).toEqual({
        existing: "data",
        injected: "value",
      });
    });

    it("should allow transformer to override existing properties", () => {
      const transformer = (ctx: Record<string, unknown>) => ({
        ...ctx,
        overridden: "new-value",
      });
      setContextTransformer(transformer);

      const context: Record<string, unknown> = { overridden: "old-value", unchanged: "same" };
      const result = applyContextTransformer(context);

      expect(result).toEqual({
        overridden: "new-value",
        unchanged: "same",
      });
    });

    it("should preserve type compatibility", () => {
      const transformer = (ctx: Record<string, unknown>) => ({
        ...ctx,
        extra: true,
      });
      setContextTransformer(transformer);

      type MyContext = { name: string; count: number };
      const context: MyContext = { name: "test", count: 10 };
      const result = applyContextTransformer(context);

      // Result should be assignable to MyContext
      expect(result.name).toBe("test");
      expect(result.count).toBe(10);
    });
  });
});
