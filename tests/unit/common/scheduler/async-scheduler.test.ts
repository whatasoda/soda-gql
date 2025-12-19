import { describe, expect, it } from "bun:test";
import { createAsyncScheduler, Effects } from "@soda-gql/common";

describe("createAsyncScheduler", () => {
  it("should execute pure effects and return the final value", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const a = yield Effects.pure(1);
      const b = yield Effects.pure(2);
      return (a as number) + (b as number);
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(3);
  });

  it("should handle defer effects", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const value = yield Effects.defer(Promise.resolve(42));
      return value;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(42);
  });

  it("should handle yield effects for event loop yielding", async () => {
    const scheduler = createAsyncScheduler();
    const order: string[] = [];

    const result = await scheduler.run(function* () {
      order.push("before");
      yield Effects.yield();
      order.push("after");
      return order;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(["before", "after"]);
  });

  it("should handle parallel effects concurrently", async () => {
    const scheduler = createAsyncScheduler();
    const startTime = Date.now();

    // Create delays to verify parallel execution
    const delay = (ms: number, value: number) =>
      new Promise<number>((resolve) => setTimeout(() => resolve(value), ms));

    const result = await scheduler.run(function* () {
      const results = yield Effects.parallel([
        Effects.defer(delay(50, 1)),
        Effects.defer(delay(50, 2)),
        Effects.defer(delay(50, 3)),
      ]);
      return results;
    });

    const elapsed = Date.now() - startTime;

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([1, 2, 3]);
    // Should complete in roughly 50ms (parallel), not 150ms (sequential)
    expect(elapsed).toBeLessThan(100);
  });

  it("should handle nested parallel effects", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const outer = yield Effects.parallel([
        Effects.pure([1, 2]),
        Effects.parallel([Effects.defer(Promise.resolve(3)), Effects.pure(4)]),
      ]);
      return outer;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([[1, 2], [3, 4]]);
  });

  it("should catch errors from rejected promises", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      yield Effects.defer(Promise.reject(new Error("Async error")));
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("Async error");
  });

  it("should catch errors thrown in generator", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      yield Effects.pure(1);
      throw new Error("Test error");
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("Test error");
  });

  it("should support custom async effect handlers", async () => {
    type CustomAsyncEffect = { readonly kind: "custom-async"; readonly value: string };

    const customHandler = {
      canHandle: (effect: { readonly kind: string }): effect is CustomAsyncEffect =>
        effect.kind === "custom-async",
      handle: async (effect: CustomAsyncEffect) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `async-processed: ${effect.value}`;
      },
    };

    const scheduler = createAsyncScheduler({ handlers: [customHandler] });

    const result = await scheduler.run(function* () {
      const result = yield { kind: "custom-async", value: "test" } satisfies CustomAsyncEffect;
      return result;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("async-processed: test");
  });

  it("should allow multiple yields to event loop", async () => {
    const scheduler = createAsyncScheduler();
    let counter = 0;

    const result = await scheduler.run(function* () {
      for (let i = 0; i < 5; i++) {
        counter++;
        yield Effects.yield();
      }
      return counter;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(5);
  });

  it("should handle mixed effect types in sequence", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const a = yield Effects.pure(1);
      yield Effects.yield();
      const b = yield Effects.defer(Promise.resolve(2));
      const [c, d] = (yield Effects.parallel([Effects.pure(3), Effects.defer(Promise.resolve(4))])) as [
        number,
        number,
      ];
      return (a as number) + (b as number) + c + d;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(10);
  });
});
