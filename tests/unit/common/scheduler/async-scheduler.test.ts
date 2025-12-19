import { describe, expect, it } from "bun:test";
import { createAsyncScheduler, DeferEffect, Effect, Effects, PureEffect, YieldEffect } from "@soda-gql/common";

describe("createAsyncScheduler", () => {
  it("should execute pure effects and return the final value", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const a = new PureEffect(1);
      yield a;
      const b = new PureEffect(2);
      yield b;
      return a.value + b.value;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(3);
  });

  it("should also work with Effects factory", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const a = Effects.pure(1);
      yield a;
      const b = Effects.pure(2);
      yield b;
      return a.value + b.value;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(3);
  });

  it("should handle defer effects", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const defer = new DeferEffect(Promise.resolve(42));
      yield defer;
      return defer.value;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(42);
  });

  it("should handle yield effects for event loop yielding", async () => {
    const scheduler = createAsyncScheduler();
    const order: string[] = [];

    const result = await scheduler.run(function* () {
      order.push("before");
      yield new YieldEffect();
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
    const delay = (ms: number, value: number) => new Promise<number>((resolve) => setTimeout(() => resolve(value), ms));

    const result = await scheduler.run(function* () {
      const parallel = Effects.parallel([Effects.defer(delay(50, 1)), Effects.defer(delay(50, 2)), Effects.defer(delay(50, 3))]);
      yield parallel;
      return parallel.value;
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
      const outer = Effects.parallel([
        Effects.pure([1, 2]),
        Effects.parallel([Effects.defer(Promise.resolve(3)), Effects.pure(4)]),
      ]);
      yield outer;
      return outer.value;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([
      [1, 2],
      [3, 4],
    ]);
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

  it("should support custom async effect classes", async () => {
    class CustomAsyncEffect extends Effect<string> {
      constructor(readonly customValue: string) {
        super();
      }
      protected _executeSync(): string {
        throw new Error("CustomAsyncEffect requires async scheduler");
      }
      protected async _executeAsync(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `async-processed: ${this.customValue}`;
      }
    }

    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const effect = new CustomAsyncEffect("test");
      yield effect;
      return effect.value;
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
        yield new YieldEffect();
      }
      return counter;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(5);
  });

  it("should handle mixed effect types in sequence", async () => {
    const scheduler = createAsyncScheduler();

    const result = await scheduler.run(function* () {
      const a = Effects.pure(1);
      yield a;
      yield Effects.yield();
      const b = Effects.defer(Promise.resolve(2));
      yield b;
      const parallel = Effects.parallel([Effects.pure(3), Effects.defer(Promise.resolve(4))]);
      yield parallel;
      const [c, d] = parallel.value as [number, number];
      return a.value + b.value + c + d;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(10);
  });
});
