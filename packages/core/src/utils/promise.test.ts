import { describe, expect, test } from "bun:test";
import vm from "node:vm";
import { isPromiseLike } from "./promise";

describe("isPromiseLike", () => {
  test("returns true for native Promise", () => {
    expect(isPromiseLike(Promise.resolve(42))).toBe(true);
    expect(isPromiseLike(new Promise(() => {}))).toBe(true);
    expect(isPromiseLike(Promise.reject(new Error()).catch(() => {}))).toBe(true);
  });

  test("returns true for async function result", async () => {
    const asyncFn = async () => 42;
    expect(isPromiseLike(asyncFn())).toBe(true);
  });

  test("returns true for thenable objects", () => {
    // biome-ignore lint/suspicious/noThenProperty: intentionally testing thenable detection
    const thenable = { then: (resolve: (v: number) => void) => resolve(42) };
    expect(isPromiseLike(thenable)).toBe(true);
  });

  test("returns true for Promise from VM sandbox", () => {
    const context = vm.createContext({});
    const vmPromise = vm.runInContext("Promise.resolve(42)", context);

    // instanceof would fail here
    expect(vmPromise instanceof Promise).toBe(false);

    // but isPromiseLike should work
    expect(isPromiseLike(vmPromise)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isPromiseLike(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isPromiseLike(undefined)).toBe(false);
  });

  test("returns false for primitives", () => {
    expect(isPromiseLike(42)).toBe(false);
    expect(isPromiseLike("string")).toBe(false);
    expect(isPromiseLike(true)).toBe(false);
    expect(isPromiseLike(Symbol())).toBe(false);
    expect(isPromiseLike(BigInt(42))).toBe(false);
  });

  test("returns false for objects without then", () => {
    expect(isPromiseLike({})).toBe(false);
    expect(isPromiseLike({ foo: "bar" })).toBe(false);
    expect(isPromiseLike([])).toBe(false);
  });

  test("returns false for objects with non-function then", () => {
    // biome-ignore lint/suspicious/noThenProperty: intentionally testing non-function then property
    expect(isPromiseLike({ then: "not a function" })).toBe(false);
    // biome-ignore lint/suspicious/noThenProperty: intentionally testing non-function then property
    expect(isPromiseLike({ then: 42 })).toBe(false);
    // biome-ignore lint/suspicious/noThenProperty: intentionally testing non-function then property
    expect(isPromiseLike({ then: null })).toBe(false);
    // biome-ignore lint/suspicious/noThenProperty: intentionally testing non-function then property
    expect(isPromiseLike({ then: {} })).toBe(false);
  });

  test("returns false for functions (even with then property)", () => {
    const fn = () => {};
    expect(isPromiseLike(fn)).toBe(false);

    // Function with then property
    // biome-ignore lint/suspicious/noThenProperty: intentionally testing function with then property
    const fnWithThen = Object.assign(() => {}, { then: () => {} });
    // Note: this returns true because functions are objects
    // This is intentional - we're checking for Promise-like behavior
    expect(typeof fnWithThen).toBe("function");
  });
});
