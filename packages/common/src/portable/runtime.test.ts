import { describe, expect, test } from "vitest";
import { once, runtime } from "./runtime";

describe("runtime", () => {
  test("detects runtime correctly", () => {
    // This test behavior depends on runtime
    if (typeof Bun !== "undefined") {
      expect(runtime.isBun).toBe(true);
      expect(runtime.isNode).toBe(false);
    } else {
      expect(runtime.isBun).toBe(false);
      expect(runtime.isNode).toBe(true);
    }
  });

  test("exactly one runtime is detected", () => {
    expect(runtime.isBun || runtime.isNode).toBe(true);
    expect(runtime.isBun && runtime.isNode).toBe(false);
  });
});

describe("once", () => {
  test("caches function result", () => {
    let callCount = 0;
    const fn = once(() => {
      callCount++;
      return "result";
    });

    expect(fn()).toBe("result");
    expect(fn()).toBe("result");
    expect(callCount).toBe(1);
  });

  test("returns same object reference", () => {
    const obj = { value: 42 };
    const fn = once(() => obj);

    const result1 = fn();
    const result2 = fn();

    expect(result1).toBe(result2);
    expect(result1).toBe(obj);
  });
});
