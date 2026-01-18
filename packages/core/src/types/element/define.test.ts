import { describe, expect, test } from "bun:test";
import { GqlDefine } from "./define";
import { GqlElement } from "./gql-element";

describe("GqlDefine", () => {
  describe("GqlDefine.create", () => {
    test("should create a valid instance with primitive value", () => {
      const define = GqlDefine.create(() => 42);

      expect(define).toBeInstanceOf(GqlDefine);
      expect(define).toBeInstanceOf(GqlElement);
    });

    test("should create a valid instance with plain object", () => {
      const define = GqlDefine.create(() => ({ key: "value" }));

      expect(define).toBeInstanceOf(GqlDefine);
    });

    test("should create a valid instance with array", () => {
      const define = GqlDefine.create(() => ["a", "b", "c"]);

      expect(define).toBeInstanceOf(GqlDefine);
    });
  });

  describe("GqlDefine.value", () => {
    test("should return primitive value from factory", () => {
      const define = GqlDefine.create(() => 42);

      expect(define.value).toBe(42);
    });

    test("should return plain object from factory", () => {
      const define = GqlDefine.create(() => ({ key: "value", nested: { foo: "bar" } }));

      expect(define.value).toEqual({ key: "value", nested: { foo: "bar" } });
    });

    test("should return array from factory", () => {
      const define = GqlDefine.create(() => ["a", "b", "c"]);

      expect(define.value).toEqual(["a", "b", "c"]);
    });

    test("should return string from factory", () => {
      const define = GqlDefine.create(() => "hello");

      expect(define.value).toBe("hello");
    });

    test("should return null from factory", () => {
      const define = GqlDefine.create(() => null);

      expect(define.value).toBeNull();
    });

    test("should handle object with non-function 'then' property as sync value", () => {
      // Edge case: object has 'then' property but it's not a function
      // This should NOT be treated as a Promise
      const define = GqlDefine.create(() => ({ then: "not-a-function", value: 42 }));

      expect(define.value).toEqual({ then: "not-a-function", value: 42 });
    });
  });

  describe("lazy evaluation", () => {
    test("should trigger lazy evaluation on first value access", () => {
      let evaluated = false;
      const define = GqlDefine.create(() => {
        evaluated = true;
        return 42;
      });

      expect(evaluated).toBe(false);
      void define.value;
      expect(evaluated).toBe(true);
    });

    test("should cache value after first evaluation", () => {
      let callCount = 0;
      const define = GqlDefine.create(() => {
        callCount++;
        return { count: callCount };
      });

      const first = define.value;
      const second = define.value;
      const third = define.value;

      expect(callCount).toBe(1);
      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe("async factory", () => {
    test("should support async factory", async () => {
      const define = GqlDefine.create(async () => "async result");

      // Async evaluation requires using the generator protocol
      const gen = GqlElement.createEvaluationGenerator(define);
      let result = gen.next();

      // Should yield a promise
      expect(result.done).toBe(false);
      expect(result.value).toBeInstanceOf(Promise);

      // Await the promise and continue
      await result.value;
      result = gen.next();

      expect(result.done).toBe(true);

      // Now value should be accessible
      expect(define.value).toBe("async result");
    });
  });

  describe("attach", () => {
    test("should support attach method from GqlElement", () => {
      const define = GqlDefine.create(() => ({ base: 42 })).attach({
        name: "extended",
        createValue: (el: GqlDefine<{ base: number }>) => ({ doubled: el.value.base * 2 }),
      });

      expect(define.value).toEqual({ base: 42 });
      expect(define.extended).toEqual({ doubled: 84 });
    });

    test("should support multiple attachments", () => {
      const define = GqlDefine.create(() => 10).attach([
        { name: "doubled", createValue: (el: GqlDefine<number>) => ({ value: el.value * 2 }) },
        { name: "tripled", createValue: (el: GqlDefine<number>) => ({ value: el.value * 3 }) },
      ] as const);

      expect(define.value).toBe(10);
      expect(define.doubled).toEqual({ value: 20 });
      expect(define.tripled).toEqual({ value: 30 });
    });
  });
});
