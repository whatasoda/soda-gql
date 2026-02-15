import { describe, expect, it } from "bun:test";
import { err, ok, type Result } from "./result";

describe("Result", () => {
  it("ok() creates OkResult with value", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it("err() creates ErrResult with error", () => {
    const result = err("failure");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("failure");
  });

  it("discriminated union narrows correctly for ok", () => {
    const result: Result<number, string> = ok(42);
    if (result.ok) {
      expect(result.value).toBe(42);
    } else {
      throw new Error("Expected ok result");
    }
  });

  it("discriminated union narrows correctly for err", () => {
    const result: Result<number, string> = err("oops");
    if (!result.ok) {
      expect(result.error).toBe("oops");
    } else {
      throw new Error("Expected err result");
    }
  });

  it("ok() works with complex types", () => {
    const result = ok({ name: "test", count: 3 });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ name: "test", count: 3 });
  });

  it("err() works with structured errors", () => {
    const result = err({ code: "NOT_FOUND", message: "missing" });
    expect(result.ok).toBe(false);
    expect(result.error).toEqual({ code: "NOT_FOUND", message: "missing" });
  });
});
