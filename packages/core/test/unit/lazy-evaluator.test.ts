import { describe, expect, mock, test } from "bun:test";
import {
  createEvaluationGenerator,
  createLazyEvaluator,
  evaluateSync,
  type LazyEvaluatorContext,
} from "../../src/types/element/lazy-evaluator";

describe("createLazyEvaluator", () => {
  // Helper to create a no-op dependency generator
  const noopDepGenerator = () => (function* (): Generator<Promise<void>, void, void> {})();

  describe("cache behavior", () => {
    test("should return value from factory on first evaluation", () => {
      const executor = createLazyEvaluator(() => ({ value: "test" }), undefined, noopDepGenerator);

      const result = evaluateSync(executor, null);

      expect(result).toEqual({ value: "test" });
    });

    test("should return cached value on subsequent calls", () => {
      const executor = createLazyEvaluator(() => ({ value: "test" }), undefined, noopDepGenerator);

      const result1 = evaluateSync(executor, null);
      const result2 = evaluateSync(executor, null);

      expect(result1).toBe(result2);
    });

    test("should not re-execute factory after caching", () => {
      const factory = mock(() => ({ value: "test" }));
      const executor = createLazyEvaluator(factory, undefined, noopDepGenerator);

      evaluateSync(executor, null);
      evaluateSync(executor, null);
      evaluateSync(executor, null);

      expect(factory).toHaveBeenCalledTimes(1);
    });

    test("should cache independently per evaluator instance", () => {
      const executor1 = createLazyEvaluator(() => ({ value: "first" }), undefined, noopDepGenerator);
      const executor2 = createLazyEvaluator(() => ({ value: "second" }), undefined, noopDepGenerator);

      const result1 = evaluateSync(executor1, null);
      const result2 = evaluateSync(executor2, null);

      expect(result1).toEqual({ value: "first" });
      expect(result2).toEqual({ value: "second" });
    });
  });

  describe("async handling", () => {
    test("should yield promise when factory returns Promise", () => {
      const executor = createLazyEvaluator(async () => ({ value: "async" }), undefined, noopDepGenerator);

      const gen = executor(null);
      const result = gen.next();

      expect(result.done).toBe(false);
      expect(result.value).toBeInstanceOf(Promise);
    });

    test("should resolve and cache async result", async () => {
      const executor = createLazyEvaluator(async () => ({ value: "async" }), undefined, noopDepGenerator);

      // Run generator to completion
      const gen = executor(null);
      const step1 = gen.next();
      expect(step1.done).toBe(false);

      // Await the yielded promise
      await step1.value;

      // Continue generator - should return cached value
      const step2 = gen.next();
      expect(step2.done).toBe(true);
      expect(step2.value).toEqual({ value: "async" });
    });

    test("should return cached value when evaluated again after async resolution", async () => {
      const factory = mock(async () => ({ value: "async" }));
      const executor = createLazyEvaluator(factory, undefined, noopDepGenerator);

      // First evaluation
      const gen1 = executor(null);
      const step1 = gen1.next();
      await step1.value;
      gen1.next();

      // Second evaluation should return cached value synchronously
      const result = evaluateSync(executor, null);

      expect(result).toEqual({ value: "async" });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    test("should yield pending promise if evaluation is in progress", async () => {
      let resolvePromise: (value: { value: string }) => void;
      const pending = new Promise<{ value: string }>((resolve) => {
        resolvePromise = resolve;
      });

      const executor = createLazyEvaluator(() => pending, undefined, noopDepGenerator);

      // Start first evaluation
      const gen1 = executor(null);
      const step1 = gen1.next();
      expect(step1.done).toBe(false);

      // Start second evaluation while first is pending
      const gen2 = executor(null);
      const step2 = gen2.next();
      expect(step2.done).toBe(false);

      // Both should yield the same promise
      expect(step1.value).toBe(step2.value);

      // Resolve the promise
      resolvePromise!({ value: "resolved" });
      await step1.value;

      // Both generators should complete with same value
      expect(gen1.next().value).toEqual({ value: "resolved" });
      expect(gen2.next().value).toEqual({ value: "resolved" });
    });
  });

  describe("dependency ordering", () => {
    test("should evaluate dependencies before main factory", () => {
      const order: string[] = [];
      const dep = { id: "dep" };

      // biome-ignore lint/correctness/useYield: sync generator for testing side effects only
      const depGenerator = function* (d: typeof dep): Generator<Promise<void>, void, void> {
        order.push(`dep:${d.id}`);
      };

      const executor = createLazyEvaluator(
        () => {
          order.push("main");
          return { value: "main" };
        },
        () => [dep],
        depGenerator,
      );

      evaluateSync(executor, null);

      expect(order).toEqual(["dep:dep", "main"]);
    });

    test("should evaluate multiple dependencies in order", () => {
      const order: string[] = [];
      const deps = [{ id: "dep1" }, { id: "dep2" }, { id: "dep3" }];

      // biome-ignore lint/correctness/useYield: sync generator for testing side effects only
      const depGenerator = function* (d: (typeof deps)[number]): Generator<Promise<void>, void, void> {
        order.push(`dep:${d.id}`);
      };

      const executor = createLazyEvaluator(
        () => {
          order.push("main");
          return { value: "main" };
        },
        () => deps,
        depGenerator,
      );

      evaluateSync(executor, null);

      expect(order).toEqual(["dep:dep1", "dep:dep2", "dep:dep3", "main"]);
    });

    test("should handle empty dependency list", () => {
      const factory = mock(() => ({ value: "test" }));
      const executor = createLazyEvaluator(factory, () => [], noopDepGenerator);

      const result = evaluateSync(executor, null);

      expect(result).toEqual({ value: "test" });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    test("should handle undefined getDeps", () => {
      const factory = mock(() => ({ value: "test" }));
      const executor = createLazyEvaluator(factory, undefined, noopDepGenerator);

      const result = evaluateSync(executor, null);

      expect(result).toEqual({ value: "test" });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    test("should yield async dependency promises", async () => {
      const depPromise = Promise.resolve();
      const dep = { id: "async-dep" };

      const depGenerator = () =>
        (function* (): Generator<Promise<void>, void, void> {
          yield depPromise;
        })();

      const executor = createLazyEvaluator(
        () => ({ value: "main" }),
        () => [dep],
        depGenerator,
      );

      const gen = executor(null);
      const step1 = gen.next();

      expect(step1.done).toBe(false);
      expect(step1.value).toBe(depPromise);
    });
  });

  describe("context propagation", () => {
    test("should pass context to factory function", () => {
      const context: LazyEvaluatorContext = { canonicalId: "test-id" };
      let receivedContext: LazyEvaluatorContext | null | undefined;

      const executor = createLazyEvaluator(
        (ctx) => {
          receivedContext = ctx;
          return { value: "test" };
        },
        undefined,
        noopDepGenerator,
      );

      evaluateSync(executor, context);

      expect(receivedContext).not.toBeNull();
      expect(receivedContext).toEqual(context);
    });

    test("should pass null context when not provided", () => {
      let receivedContext: LazyEvaluatorContext | null | undefined;

      const executor = createLazyEvaluator(
        (ctx) => {
          receivedContext = ctx;
          return { value: "test" };
        },
        undefined,
        noopDepGenerator,
      );

      evaluateSync(executor, null);

      expect(receivedContext).toBeNull();
    });
  });
});

describe("evaluateSync", () => {
  const noopDepGenerator = () => (function* (): Generator<Promise<void>, void, void> {})();

  test("should return value for sync factory", () => {
    const executor = createLazyEvaluator(() => ({ value: "sync" }), undefined, noopDepGenerator);

    const result = evaluateSync(executor, null);

    expect(result).toEqual({ value: "sync" });
  });

  test("should return cached value", () => {
    const executor = createLazyEvaluator(() => ({ value: "cached" }), undefined, noopDepGenerator);

    evaluateSync(executor, null);
    const result = evaluateSync(executor, null);

    expect(result).toEqual({ value: "cached" });
  });

  test("should throw for async factory", () => {
    const executor = createLazyEvaluator(async () => ({ value: "async" }), undefined, noopDepGenerator);

    expect(() => evaluateSync(executor, null)).toThrow("Async operation is not supported in sync evaluation.");
  });

  test("should throw for async dependency", () => {
    const depGenerator = () =>
      (function* (): Generator<Promise<void>, void, void> {
        yield Promise.resolve();
      })();

    const executor = createLazyEvaluator(
      () => ({ value: "main" }),
      () => [{ id: "async-dep" }],
      depGenerator,
    );

    expect(() => evaluateSync(executor, null)).toThrow("Async operation is not supported in sync evaluation.");
  });
});

describe("createEvaluationGenerator", () => {
  const noopDepGenerator = () => (function* (): Generator<Promise<void>, void, void> {})();

  test("should yield all promises from executor", async () => {
    const promises: Promise<void>[] = [];
    const executor = createLazyEvaluator(async () => ({ value: "async" }), undefined, noopDepGenerator);

    const gen = createEvaluationGenerator(executor, null);
    let result = gen.next();
    while (!result.done) {
      promises.push(result.value);
      await result.value;
      result = gen.next();
    }

    expect(promises.length).toBe(1);
    expect(result.value).toBeUndefined();
  });

  test("should discard executor return value", () => {
    const executor = createLazyEvaluator(() => ({ value: "sync" }), undefined, noopDepGenerator);

    const gen = createEvaluationGenerator(executor, null);
    const result = gen.next();

    expect(result.done).toBe(true);
    expect(result.value).toBeUndefined();
  });

  test("should pass context to executor", () => {
    const context: LazyEvaluatorContext = { canonicalId: "test-id" };
    let receivedContext: LazyEvaluatorContext | null | undefined;

    const executor = createLazyEvaluator(
      (ctx) => {
        receivedContext = ctx;
        return { value: "test" };
      },
      undefined,
      noopDepGenerator,
    );

    const gen = createEvaluationGenerator(executor, context);
    gen.next();

    expect(receivedContext).toEqual(context);
  });
});
